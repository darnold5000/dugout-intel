export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OpponentWorkspace } from "@/components/opponent/OpponentWorkspace";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, MapPin } from "lucide-react";
import type { OpponentDetail } from "@/types";

export default async function OpponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: opponent } = await supabase
    .from("opponents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!opponent) notFound();

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

  const detail: OpponentDetail = {
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
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader userEmail={user?.email} />
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/opponents">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to opponents
          </Link>
        </Button>

        <div className="mb-4 flex items-center gap-3">
          <Badge variant="secondary">{opponent.age_level}</Badge>
          {opponent.location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {opponent.location}
            </p>
          )}
        </div>

        <Suspense fallback={<LoadingSpinner label="Loading workspace..." />}>
          <OpponentWorkspace opponentId={id} initialData={detail} />
        </Suspense>
      </main>
    </div>
  );
}
