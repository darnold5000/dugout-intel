import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";
import { extractFromScreenshot, fileToDataUrl } from "@/lib/ai";
import type { ExtractionResult } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opponentId } = await params;
  const supabase = await getSupabaseFromRequest(request);

  console.log(
    "[extract] OPENAI_API_KEY configured:",
    !!process.env.OPENAI_API_KEY
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log(
    "[extract] user verified:",
    !!user,
    user ? `id=${user.id}` : authError?.message ?? "no user"
  );

  if (authError || !user) {
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

  let uploadIds: string[] | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.upload_ids && Array.isArray(body.upload_ids)) {
      uploadIds = body.upload_ids;
    }
  } catch {
    // empty body is fine
  }

  let query = supabase
    .from("screenshot_uploads")
    .select("*")
    .eq("opponent_id", opponentId);

  if (uploadIds?.length) {
    query = query.in("id", uploadIds);
  } else {
    query = query.in("extraction_status", ["pending", "failed"]);
  }

  const { data: uploads, error: fetchError } = await query;

  if (fetchError) {
    console.log("[extract] fetch uploads error:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!uploads || uploads.length === 0) {
    return NextResponse.json(
      { error: "No screenshots available for extraction" },
      { status: 400 }
    );
  }

  const results: ExtractionResult[] = [];
  let anyFailed = false;

  for (const upload of uploads) {
    console.log("[extract] processing upload:", upload.id, upload.file_path);

    await supabase
      .from("screenshot_uploads")
      .update({ extraction_status: "processing", extraction_error: null })
      .eq("id", upload.id);

    try {
      // Clear previously extracted data when re-running extraction
      await supabase
        .from("extracted_players")
        .delete()
        .eq("source_upload_id", upload.id);
      await supabase
        .from("extracted_batting_stats")
        .delete()
        .eq("source_upload_id", upload.id);
      await supabase
        .from("extracted_pitching_stats")
        .delete()
        .eq("source_upload_id", upload.id);
      await supabase
        .from("extracted_games")
        .delete()
        .eq("source_upload_id", upload.id);

      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("gamechanger-screenshots")
        .download(upload.file_path);

      if (downloadError || !fileBlob) {
        throw new Error(
          downloadError?.message ?? "Failed to download screenshot from storage"
        );
      }

      const imageDataUrl = await fileToDataUrl(fileBlob);
      const extraction = await extractFromScreenshot(imageDataUrl);

      const counts = {
        players: extraction.players.length,
        batting_stats: extraction.batting_stats.length,
        pitching_stats: extraction.pitching_stats.length,
        games: extraction.games.length,
      };

      console.log("[extract] extracted counts:", upload.id, counts);

      for (const player of extraction.players) {
        const { error } = await supabase.from("extracted_players").insert({
          opponent_id: opponentId,
          name: player.name,
          jersey_number: player.jersey_number,
          positions: player.positions,
          confidence: player.confidence,
          source_upload_id: upload.id,
        });
        if (error) {
          console.log("[extract] insert player error:", error.message);
          throw new Error(`Failed to save players: ${error.message}`);
        }
      }

      for (const stat of extraction.batting_stats) {
        const { error } = await supabase
          .from("extracted_batting_stats")
          .insert({
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
        if (error) {
          console.log("[extract] insert batting error:", error.message);
          throw new Error(`Failed to save batting stats: ${error.message}`);
        }
      }

      for (const stat of extraction.pitching_stats) {
        const { error } = await supabase
          .from("extracted_pitching_stats")
          .insert({
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
        if (error) {
          console.log("[extract] insert pitching error:", error.message);
          throw new Error(`Failed to save pitching stats: ${error.message}`);
        }
      }

      for (const game of extraction.games) {
        const { error } = await supabase.from("extracted_games").insert({
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
        if (error) {
          console.log("[extract] insert game error:", error.message);
          throw new Error(`Failed to save games: ${error.message}`);
        }
      }

      await supabase
        .from("screenshot_uploads")
        .update({
          extraction_status: "complete",
          screenshot_type: extraction.screenshot_type,
          extraction_error: null,
        })
        .eq("id", upload.id);

      results.push({
        upload_id: upload.id,
        status: "complete",
        screenshot_type: extraction.screenshot_type,
        counts,
        warnings: extraction.warnings,
        unknowns: extraction.unknowns,
      });
    } catch (err) {
      anyFailed = true;
      const errorMessage =
        err instanceof Error ? err.message : "Extraction failed";

      console.log("[extract] failed:", upload.id, errorMessage);

      await supabase
        .from("screenshot_uploads")
        .update({
          extraction_status: "failed",
          extraction_error: errorMessage,
        })
        .eq("id", upload.id);

      results.push({
        upload_id: upload.id,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  const totals = results
    .filter((r) => r.status === "complete" && r.counts)
    .reduce(
      (acc, r) => ({
        players: acc.players + (r.counts?.players ?? 0),
        batting_stats: acc.batting_stats + (r.counts?.batting_stats ?? 0),
        pitching_stats: acc.pitching_stats + (r.counts?.pitching_stats ?? 0),
        games: acc.games + (r.counts?.games ?? 0),
      }),
      { players: 0, batting_stats: 0, pitching_stats: 0, games: 0 }
    );

  const responseBody = { results, totals, success: !anyFailed };

  if (anyFailed) {
    return NextResponse.json(responseBody, { status: 500 });
  }

  return NextResponse.json(responseBody);
}
