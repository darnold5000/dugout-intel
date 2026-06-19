import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: opponentId, noteId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.note_text !== undefined) updates.note_text = body.note_text;
  if (body.note_type !== undefined) updates.note_type = body.note_type;
  if (body.importance !== undefined) updates.importance = body.importance;
  if (body.game_date !== undefined) updates.game_date = body.game_date || null;
  if (body.opponent_played !== undefined) updates.opponent_played = body.opponent_played || null;
  if (body.game_type !== undefined) updates.game_type = body.game_type;
  if (body.included_in_report !== undefined) updates.included_in_report = body.included_in_report;

  const { data, error } = await supabase
    .from("opponent_notes")
    .update(updates)
    .eq("id", noteId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: opponentId, noteId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("opponent_notes")
    .delete()
    .eq("id", noteId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
