import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";
import { rebuildOpponentStats } from "@/lib/extraction/rebuild-opponent-stats";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  const { id: opponentId, uploadId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const allowed = [
    "screenshot_type",
    "included_in_report",
    "game_date",
    "opponent_played",
    "tournament_name",
    "game_type",
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("screenshot_uploads")
    .update(updates)
    .eq("id", uploadId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  const { id: opponentId, uploadId } = await params;
  const supabase = await getSupabaseFromRequest(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: upload } = await supabase
    .from("screenshot_uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (!upload) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const { error: storageError } = await supabase.storage
    .from("gamechanger-screenshots")
    .remove([upload.file_path]);

  if (storageError) {
    return NextResponse.json(
      { error: `Storage delete failed: ${storageError.message}` },
      { status: 500 }
    );
  }

  const { error: dbError } = await supabase
    .from("screenshot_uploads")
    .delete()
    .eq("id", uploadId);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  try {
    await rebuildOpponentStats(supabase, opponentId, undefined, {
      userId: user.id,
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ success: true });
}
