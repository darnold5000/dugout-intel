import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";

async function verifyOpponent(
  supabase: Awaited<ReturnType<typeof getSupabaseFromRequest>>,
  opponentId: string,
  userId: string
) {
  const { data } = await supabase
    .from("opponents")
    .select("id")
    .eq("id", opponentId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function GET(
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

  if (!(await verifyOpponent(supabase, opponentId, user.id))) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("opponent_notes")
    .select("*")
    .eq("opponent_id", opponentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

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

  if (!(await verifyOpponent(supabase, opponentId, user.id))) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const body = await request.json();
  if (!body.note_text?.trim()) {
    return NextResponse.json({ error: "note_text is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("opponent_notes")
    .insert({
      opponent_id: opponentId,
      user_id: user.id,
      note_text: body.note_text.trim(),
      note_type: body.note_type ?? "general",
      importance: body.importance ?? "medium",
      game_date: body.game_date || null,
      opponent_played: body.opponent_played || null,
      game_type: body.game_type ?? "unknown",
      included_in_report: body.included_in_report ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
