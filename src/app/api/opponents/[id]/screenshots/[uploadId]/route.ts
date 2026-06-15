import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";

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
    console.log("[delete-screenshot] storage error:", storageError.message);
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
    console.log("[delete-screenshot] db error:", dbError.message);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  console.log("[delete-screenshot] deleted:", uploadId, "for user", user.id);
  return NextResponse.json({ success: true });
}
