import { NextResponse } from "next/server";
import { getSupabaseFromRequest } from "@/lib/supabase/request";
import { rebuildOpponentStats } from "@/lib/extraction/rebuild-opponent-stats";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opponentId } = await params;
  const supabase = await getSupabaseFromRequest(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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

  try {
    const { counts, warnings } = await rebuildOpponentStats(
      supabase,
      opponentId
    );

    return NextResponse.json({
      success: true,
      counts,
      warnings,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to rebuild consolidated stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
