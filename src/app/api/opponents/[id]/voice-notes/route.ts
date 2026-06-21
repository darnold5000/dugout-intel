import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";
import { transcribeAudio } from "@/lib/ai";

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
    .select("id, name")
    .eq("id", opponentId)
    .eq("user_id", user.id)
    .single();

  if (!opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const noteType = (formData.get("note_type") as string) || "general";
  const gameType = (formData.get("game_type") as string) || "unknown";
  const gameDate = (formData.get("game_date") as string) || null;
  const opponentPlayed = (formData.get("opponent_played") as string) || null;
  const transcriptOverride = formData.get("transcript_text") as string | null;

  if (!file && !transcriptOverride?.trim()) {
    return NextResponse.json(
      { error: "Audio file or transcript_text required" },
      { status: 400 }
    );
  }

  const noteId = crypto.randomUUID();
  let filePath: string | null = null;
  let transcript = transcriptOverride?.trim() ?? "";

  if (file) {
    const ext = file.name.split(".").pop() || "webm";
    filePath = `${user.id}/${opponentId}/voice-notes/${noteId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    if (!transcript) {
      try {
        transcript = await transcribeAudio(buffer, file.type || "audio/webm");
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Transcription failed",
          },
          { status: 500 }
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("opponent_voice_notes")
    .insert({
      id: noteId,
      opponent_id: opponentId,
      user_id: user.id,
      audio_file_path: filePath,
      transcript_text: transcript,
      note_type: noteType,
      game_type: gameType,
      game_date: gameDate,
      opponent_played: opponentPlayed,
      opponent_name: opponent.name,
      included_in_report: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
