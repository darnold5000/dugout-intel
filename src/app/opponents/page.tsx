export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { OpponentCard } from "@/components/OpponentCard";
import { EmptyState } from "@/components/EmptyState";
import { Plus } from "lucide-react";

export default async function OpponentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: opponents } = await supabase
    .from("opponents")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const opponentIds = opponents?.map((o) => o.id) ?? [];

  const { data: uploadCounts } = opponentIds.length
    ? await supabase
        .from("screenshot_uploads")
        .select("opponent_id")
        .in("opponent_id", opponentIds)
    : { data: [] };

  const { data: reportCounts } = opponentIds.length
    ? await supabase
        .from("scouting_reports")
        .select("opponent_id")
        .in("opponent_id", opponentIds)
    : { data: [] };

  const uploadCountMap = (uploadCounts ?? []).reduce(
    (acc, u) => {
      acc[u.opponent_id] = (acc[u.opponent_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const reportSet = new Set(
    (reportCounts ?? []).map((r) => r.opponent_id)
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader userEmail={user?.email} />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Opponents</h1>
          <Button asChild>
            <Link href="/opponents/new">
              <Plus className="h-4 w-4 mr-1" />
              New opponent
            </Link>
          </Button>
        </div>

        {!opponents || opponents.length === 0 ? (
          <EmptyState
            title="No opponents yet"
            description="Add an opponent team to start uploading GameChanger screenshots."
            actionLabel="Create opponent"
            actionHref="/opponents/new"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opponents.map((opponent) => (
              <OpponentCard
                key={opponent.id}
                opponent={opponent}
                uploadCount={uploadCountMap[opponent.id] ?? 0}
                hasReport={reportSet.has(opponent.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
