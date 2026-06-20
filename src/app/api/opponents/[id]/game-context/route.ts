import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";

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

  const { data: opponent } = await supabase
    .from("opponents")
    .select("id")
    .eq("id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (!opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const body = await request.json();

  const parseInnings = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const parsePitchCount = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    const n = Number.parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
  };

  const { data, error } = await supabase
    .from("opponent_game_context")
    .insert({
      opponent_id: opponentId,
      user_id: user.id,
      game_date: body.game_date || null,
      opponent_played: body.opponent_played || null,
      tournament_name: body.tournament_name || null,
      game_type: body.game_type ?? "unknown",
      inning_observed: body.inning_observed || null,
      score_when_pitcher_entered: body.score_when_pitcher_entered || null,
      reason_pitcher_entered: body.reason_pitcher_entered ?? "unknown",
      leverage: body.leverage ?? "medium",
      notes: body.notes || null,
      result: body.result || null,
      runs_for:
        body.runs_for != null && body.runs_for !== ""
          ? Number(body.runs_for)
          : null,
      runs_against:
        body.runs_against != null && body.runs_against !== ""
          ? Number(body.runs_against)
          : null,
      pitcher_jersey_number: body.pitcher_jersey_number?.trim() || null,
      pitcher_name: body.pitcher_name?.trim() || null,
      innings_pitched: parseInnings(body.innings_pitched),
      pitch_count: parsePitchCount(body.pitch_count),
      pitcher_role: body.pitcher_role ?? "unknown",
      included_in_report: body.included_in_report ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
