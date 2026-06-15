import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFromScreenshot } from "@/lib/ai";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opponentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: opponent } = await supabase
    .from("opponents")
    .select("id")
    .eq("id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (!opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const { data: uploads, error: fetchError } = await supabase
    .from("screenshot_uploads")
    .select("*")
    .eq("opponent_id", opponentId)
    .in("extraction_status", ["pending", "failed"]);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!uploads || uploads.length === 0) {
    return NextResponse.json(
      { error: "No pending screenshots to extract" },
      { status: 400 }
    );
  }

  const results = [];

  for (const upload of uploads) {
    await supabase
      .from("screenshot_uploads")
      .update({ extraction_status: "processing" })
      .eq("id", upload.id);

    try {
      const extraction = await extractFromScreenshot(upload.file_url);

      await supabase
        .from("screenshot_uploads")
        .update({
          extraction_status: "complete",
          screenshot_type: extraction.screenshot_type,
        })
        .eq("id", upload.id);

      for (const player of extraction.players) {
        await supabase.from("extracted_players").insert({
          opponent_id: opponentId,
          name: player.name,
          jersey_number: player.jersey_number,
          positions: player.positions,
          confidence: player.confidence,
          source_upload_id: upload.id,
        });
      }

      for (const stat of extraction.batting_stats) {
        await supabase.from("extracted_batting_stats").insert({
          opponent_id: opponentId,
          player_name: stat.player_name,
          jersey_number: stat.jersey_number,
          avg: stat.avg,
          obp: stat.obp,
          ops: stat.ops,
          hits: stat.hits,
          walks: stat.walks,
          strikeouts: stat.strikeouts,
          rbi: stat.rbi,
          runs: stat.runs,
          stolen_bases: stat.stolen_bases,
          confidence: stat.confidence,
          source_upload_id: upload.id,
        });
      }

      for (const stat of extraction.pitching_stats) {
        await supabase.from("extracted_pitching_stats").insert({
          opponent_id: opponentId,
          player_name: stat.player_name,
          jersey_number: stat.jersey_number,
          innings_pitched: stat.innings_pitched,
          pitches: stat.pitches,
          strike_percentage: stat.strike_percentage,
          era: stat.era,
          walks: stat.walks,
          strikeouts: stat.strikeouts,
          hits_allowed: stat.hits_allowed,
          runs_allowed: stat.runs_allowed,
          confidence: stat.confidence,
          source_upload_id: upload.id,
        });
      }

      for (const game of extraction.games) {
        await supabase.from("extracted_games").insert({
          opponent_id: opponentId,
          opponent_name: game.opponent_name,
          game_date: game.game_date,
          result: game.result,
          runs_for: game.runs_for,
          runs_against: game.runs_against,
          notes: game.notes,
          confidence: game.confidence,
          source_upload_id: upload.id,
        });
      }

      results.push({
        upload_id: upload.id,
        status: "complete",
        screenshot_type: extraction.screenshot_type,
        warnings: extraction.warnings,
        unknowns: extraction.unknowns,
      });
    } catch (err) {
      await supabase
        .from("screenshot_uploads")
        .update({ extraction_status: "failed" })
        .eq("id", upload.id);

      results.push({
        upload_id: upload.id,
        status: "failed",
        error: err instanceof Error ? err.message : "Extraction failed",
      });
    }
  }

  return NextResponse.json({ results });
}
