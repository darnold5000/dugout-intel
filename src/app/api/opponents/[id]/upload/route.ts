import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
export async function POST(
  request: Request,
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

  const { data: opponent } = await supabase
    .from("opponents")
    .select("id")
    .eq("id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (!opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const admin = createServiceClient();
  const uploads = [];

  for (const file of files) {
    const uploadId = crypto.randomUUID();
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${user.id}/${opponentId}/${uploadId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: storageError } = await admin.storage
      .from("gamechanger-screenshots")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      return NextResponse.json(
        { error: `Upload failed: ${storageError.message}` },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("gamechanger-screenshots").getPublicUrl(filePath);

    const { data: upload, error: dbError } = await supabase
      .from("screenshot_uploads")
      .insert({
        id: uploadId,
        user_id: user.id,
        opponent_id: opponentId,
        file_url: publicUrl,
        file_path: filePath,
        extraction_status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    uploads.push(upload);
  }

  return NextResponse.json(uploads, { status: 201 });
}
