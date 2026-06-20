import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: opponent, error } = await supabase
    .from("opponents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const [
    { data: screenshot_uploads },
    { data: opponent_notes },
    { data: opponent_documents },
    { data: opponent_voice_notes },
    { data: opponent_game_context },
    { data: extracted_players },
    { data: extracted_batting_stats },
    { data: extracted_pitching_stats },
    { data: extracted_games },
    { data: scouting_reports },
    { data: pitching_ledger_entries },
  ] = await Promise.all([
    supabase
      .from("screenshot_uploads")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opponent_notes")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opponent_documents")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opponent_voice_notes")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opponent_game_context")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("extracted_players").select("*").eq("opponent_id", id),
    supabase.from("extracted_batting_stats").select("*").eq("opponent_id", id),
    supabase.from("extracted_pitching_stats").select("*").eq("opponent_id", id),
    supabase.from("extracted_games").select("*").eq("opponent_id", id),
    supabase
      .from("scouting_reports")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pitching_ledger_entries")
      .select("*")
      .eq("opponent_id", id)
      .order("game_date", { ascending: true }),
  ]);

  return NextResponse.json({
    ...opponent,
    screenshot_uploads: screenshot_uploads ?? [],
    opponent_notes: opponent_notes ?? [],
    opponent_documents: opponent_documents ?? [],
    opponent_voice_notes: opponent_voice_notes ?? [],
    opponent_game_context: opponent_game_context ?? [],
    pitching_ledger_entries: pitching_ledger_entries ?? [],
    extracted_players: extracted_players ?? [],
    extracted_batting_stats: extracted_batting_stats ?? [],
    extracted_pitching_stats: extracted_pitching_stats ?? [],
    extracted_games: extracted_games ?? [],
    scouting_reports: scouting_reports ?? [],
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!opponent) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
  }

  const { error } = await supabase.from("opponents").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
