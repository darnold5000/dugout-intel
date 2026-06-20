import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; contextId: string }> }
) {
  const { id: opponentId, contextId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowed = [
    "game_date",
    "opponent_played",
    "tournament_name",
    "game_type",
    "inning_observed",
    "score_when_pitcher_entered",
    "reason_pitcher_entered",
    "leverage",
    "notes",
    "result",
    "runs_for",
    "runs_against",
    "pitcher_jersey_number",
    "pitcher_name",
    "innings_pitched",
    "pitch_count",
    "pitcher_role",
    "included_in_report",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("opponent_game_context")
    .update(updates)
    .eq("id", contextId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Game context not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; contextId: string }> }
) {
  const { id: opponentId, contextId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("opponent_game_context")
    .delete()
    .eq("id", contextId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
