import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";

const STORAGE_BUCKET = "gamechanger-screenshots";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: opponentId, docId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.extracted_text !== undefined) updates.extracted_text = body.extracted_text;
  if (body.included_in_report !== undefined) updates.included_in_report = body.included_in_report;

  const { data, error } = await supabase
    .from("opponent_documents")
    .update(updates)
    .eq("id", docId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: opponentId, docId } = await params;
  const supabase = await getSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: doc } = await supabase
    .from("opponent_documents")
    .select("file_path")
    .eq("id", docId)
    .eq("opponent_id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await supabase.storage.from(STORAGE_BUCKET).remove([doc.file_path]);

  const { error } = await supabase
    .from("opponent_documents")
    .delete()
    .eq("id", docId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
