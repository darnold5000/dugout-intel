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
    { data: extracted_players },
    { data: extracted_batting_stats },
    { data: extracted_pitching_stats },
    { data: extracted_games },
    { data: scouting_reports },
  ] = await Promise.all([
    supabase
      .from("screenshot_uploads")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("extracted_players")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at"),
    supabase
      .from("extracted_batting_stats")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at"),
    supabase
      .from("extracted_pitching_stats")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at"),
    supabase
      .from("extracted_games")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at"),
    supabase
      .from("scouting_reports")
      .select("*")
      .eq("opponent_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ...opponent,
    screenshot_uploads: screenshot_uploads ?? [],
    extracted_players: extracted_players ?? [],
    extracted_batting_stats: extracted_batting_stats ?? [],
    extracted_pitching_stats: extracted_pitching_stats ?? [],
    extracted_games: extracted_games ?? [],
    scouting_reports: scouting_reports ?? [],
  });
}
