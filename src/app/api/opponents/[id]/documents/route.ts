import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";
import { extractDocumentText } from "@/lib/ai";

const STORAGE_BUCKET = "gamechanger-screenshots";

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const docId = crypto.randomUUID();
  const ext = file.name.split(".").pop() || "bin";
  const filePath = `${user.id}/${opponentId}/documents/${docId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  let extractedText = "";
  try {
    extractedText = await extractDocumentText(buffer, file.name, file.type);
  } catch {
    extractedText = `Uploaded document: ${file.name}`;
  }

  const { data, error } = await supabase
    .from("opponent_documents")
    .insert({
      id: docId,
      opponent_id: opponentId,
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type || ext,
      extracted_text: extractedText,
      included_in_report: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
