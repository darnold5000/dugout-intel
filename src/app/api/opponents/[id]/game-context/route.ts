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
      included_in_report: body.included_in_report ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
