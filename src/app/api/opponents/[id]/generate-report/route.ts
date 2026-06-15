import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateScoutingReport } from "@/lib/ai";

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
    { data: players },
    { data: battingStats },
    { data: pitchingStats },
    { data: games },
  ] = await Promise.all([
    supabase
      .from("extracted_players")
      .select("*")
      .eq("opponent_id", opponentId),
    supabase
      .from("extracted_batting_stats")
      .select("*")
      .eq("opponent_id", opponentId),
    supabase
      .from("extracted_pitching_stats")
      .select("*")
      .eq("opponent_id", opponentId),
    supabase.from("extracted_games").select("*").eq("opponent_id", opponentId),
  ]);

  const hasData =
    (players?.length ?? 0) > 0 ||
    (battingStats?.length ?? 0) > 0 ||
    (pitchingStats?.length ?? 0) > 0 ||
    (games?.length ?? 0) > 0;

  if (!hasData) {
    return NextResponse.json(
      { error: "No extracted data available. Run extraction first." },
      { status: 400 }
    );
  }

  try {
    const { reportJson, reportText } = await generateScoutingReport({
      opponentName: opponent.name,
      ageLevel: opponent.age_level,
      players: players ?? [],
      battingStats: battingStats ?? [],
      pitchingStats: pitchingStats ?? [],
      games: games ?? [],
    });

    const { data: report, error: saveError } = await supabase
      .from("scouting_reports")
      .insert({
        opponent_id: opponentId,
        user_id: user.id,
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
        error:
          err instanceof Error ? err.message : "Report generation failed",
      },
      { status: 500 }
    );
  }
}
