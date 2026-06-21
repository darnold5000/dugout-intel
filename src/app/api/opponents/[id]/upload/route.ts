import { NextResponse } from "next/server";
import { createClientFromAccessToken } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opponentId } = await params;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[upload] auth: missing or invalid Authorization header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = authHeader.slice("Bearer ".length).trim();
  if (!accessToken) {
    console.log("[upload] auth: empty access token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClientFromAccessToken(accessToken);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log(
    "[upload] user verified:",
    !!user,
    user ? `id=${user.id}` : authError?.message ?? "no user"
  );

  if (authError || !user) {
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
  const gameDate = (formData.get("game_date") as string | null)?.trim() || null;
  const opponentPlayed =
    (formData.get("opponent_played") as string | null)?.trim() || null;
  const tournamentName =
    (formData.get("tournament_name") as string | null)?.trim() || null;
  const gameType =
    (formData.get("game_type") as string | null)?.trim() || "unknown";
  const screenshotType =
    (formData.get("screenshot_type") as string | null)?.trim() || null;

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const uploads = [];

  for (const file of files) {
    const uploadId = crypto.randomUUID();
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${user.id}/${opponentId}/${uploadId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: storageError } = await supabase.storage
      .from("gamechanger-screenshots")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.log("[upload] storage error:", storageError.message);
      return NextResponse.json(
        { error: `Upload failed: ${storageError.message}` },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("gamechanger-screenshots").getPublicUrl(filePath);

    const { data: upload, error: dbError } = await supabase
      .from("screenshot_uploads")
      .insert({
        id: uploadId,
        user_id: user.id,
        opponent_id: opponentId,
        file_url: publicUrl,
        file_path: filePath,
        extraction_status: "pending",
        game_date: gameDate,
        opponent_played: opponentPlayed,
        tournament_name: tournamentName,
        game_type: gameType,
        screenshot_type: screenshotType,
      })
      .select()
      .single();

    if (dbError) {
      console.log("[upload] db error:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    uploads.push(upload);
  }

  console.log("[upload] success:", uploads.length, "file(s) for user", user.id);
  return NextResponse.json(uploads, { status: 201 });
}
