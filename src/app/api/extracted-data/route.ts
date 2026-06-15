import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TABLES = [
  "extracted_players",
  "extracted_batting_stats",
  "extracted_pitching_stats",
  "extracted_games",
] as const;

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { table, id, updates } = body;

  if (!table || !id || !updates) {
    return NextResponse.json(
      { error: "table, id, and updates are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const { data: record } = await supabase
    .from(table)
    .select("opponent_id")
    .eq("id", id)
    .single();

  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const { data: opponent } = await supabase
    .from("opponents")
    .select("id")
    .eq("id", record.opponent_id)
    .eq("user_id", user.id)
    .single();

  if (!opponent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
