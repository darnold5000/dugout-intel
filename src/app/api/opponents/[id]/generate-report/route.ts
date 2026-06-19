import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";
import { generateScoutingReport } from "@/lib/ai";
import {
  buildEvidencePacket,
  hasEvidenceForReport,
} from "@/lib/scouting/evidence-packet";
import type { OpponentDetail } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opponentId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : `Scouting Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const { data: opponent, error: oppError } = await supabase
    .from("opponents")
    .select("*")
    .eq("id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (oppError || !opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const [
    { data: screenshot_uploads },
    { data: opponent_notes },
    { data: opponent_documents },
    { data: opponent_voice_notes },
    { data: opponent_game_context },
    { data: extracted_players },
    { data: extracted_batting_stats },
    { data: extracted_pitching_stats },
    { data: extracted_games },
    { data: scouting_reports },
  ] = await Promise.all([
    supabase
      .from("screenshot_uploads")
      .select("*")
      .eq("opponent_id", opponentId)
      .order("created_at", { ascending: false }),
    supabase.from("opponent_notes").select("*").eq("opponent_id", opponentId),
    supabase.from("opponent_documents").select("*").eq("opponent_id", opponentId),
    supabase.from("opponent_voice_notes").select("*").eq("opponent_id", opponentId),
    supabase.from("opponent_game_context").select("*").eq("opponent_id", opponentId),
    supabase.from("extracted_players").select("*").eq("opponent_id", opponentId),
    supabase.from("extracted_batting_stats").select("*").eq("opponent_id", opponentId),
    supabase.from("extracted_pitching_stats").select("*").eq("opponent_id", opponentId),
    supabase.from("extracted_games").select("*").eq("opponent_id", opponentId),
    supabase
      .from("scouting_reports")
      .select("*")
      .eq("opponent_id", opponentId)
      .order("created_at", { ascending: false }),
  ]);

  const opponentDetail: OpponentDetail = {
    ...opponent,
    screenshot_uploads: screenshot_uploads ?? [],
    opponent_notes: opponent_notes ?? [],
    opponent_documents: opponent_documents ?? [],
    opponent_voice_notes: opponent_voice_notes ?? [],
    opponent_game_context: opponent_game_context ?? [],
    extracted_players: extracted_players ?? [],
    extracted_batting_stats: extracted_batting_stats ?? [],
    extracted_pitching_stats: extracted_pitching_stats ?? [],
    extracted_games: extracted_games ?? [],
    scouting_reports: scouting_reports ?? [],
  };

  const evidencePacket = buildEvidencePacket(opponentDetail);

  if (!hasEvidenceForReport(evidencePacket)) {
    return NextResponse.json(
      {
        error:
          "No evidence available. Add screenshots, notes, voice notes, or documents first.",
      },
      { status: 400 }
    );
  }

  try {
    const { reportJson, reportText } = await generateScoutingReport({
      opponentName: opponent.name,
      ageLevel: opponent.age_level,
      opponentDetail,
      evidencePacket,
    });

    const { data: report, error: saveError } = await supabase
      .from("scouting_reports")
      .insert({
        opponent_id: opponentId,
        user_id: user.id,
        title,
        report_json: reportJson,
        report_text: reportText,
      })
      .select()
      .single();

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Report generation failed",
      },
      { status: 500 }
    );
  }
}
