"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/opponent/OverviewTab";
import { EvidenceTab } from "@/components/opponent/EvidenceTab";
import { PlayersTab } from "@/components/opponent/PlayersTab";
import { PitchingTab } from "@/components/opponent/PitchingTab";
import { ReportsTab } from "@/components/opponent/ReportsTab";
import { getAuthHeaders } from "@/lib/auth-headers";
import { buildPlayerProfiles } from "@/lib/scouting/player-profiles";
import type { OpponentDetail } from "@/types";

interface OpponentWorkspaceProps {
  opponentId: string;
  initialData: OpponentDetail;
}

function evidenceCount(data: OpponentDetail): number {
  return (
    (data.screenshot_uploads?.length ?? 0) +
    (data.opponent_notes?.length ?? 0) +
    (data.opponent_voice_notes?.length ?? 0) +
    (data.opponent_documents?.length ?? 0) +
    (data.opponent_game_context?.length ?? 0)
  );
}

export function OpponentWorkspace({
  opponentId,
  initialData,
}: OpponentWorkspaceProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab =
    tabParam === "screenshots" ? "evidence" : tabParam ?? "overview";
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab === "screenshots" ? "evidence" : tab);
  }, [searchParams]);

  const refresh = useCallback(async () => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/opponents/${opponentId}`, {
      headers: authHeaders,
    });
    if (res.ok) {
      setData(await res.json());
    }
  }, [opponentId]);

  const playerCount = buildPlayerProfiles(data).length;
  const evidenceTotal = useMemo(() => evidenceCount(data), [data]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 -mx-1 px-1">
        <TabsList className="w-full flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">
            Overview
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex-1 sm:flex-none">
            Evidence ({evidenceTotal})
          </TabsTrigger>
          <TabsTrigger value="players" className="flex-1 sm:flex-none">
            Players ({playerCount})
          </TabsTrigger>
          <TabsTrigger value="pitching" className="flex-1 sm:flex-none">
            Pitching
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-1 sm:flex-none">
            Scouting Report ({data.scouting_reports.length})
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview">
        <OverviewTab
          data={data}
          onRefresh={refresh}
          onSwitchTab={setActiveTab}
        />
      </TabsContent>

      <TabsContent value="evidence">
        <EvidenceTab
          opponentId={opponentId}
          opponentName={data.name}
          data={data}
          onRefresh={refresh}
        />
      </TabsContent>

      <TabsContent value="players">
        <PlayersTab data={data} onRefresh={refresh} />
      </TabsContent>

      <TabsContent value="pitching">
        <PitchingTab data={data} />
      </TabsContent>

      <TabsContent value="report">
        <ReportsTab
          opponentId={opponentId}
          reports={data.scouting_reports}
          playerCount={playerCount}
          screenshotCount={data.screenshot_uploads.length}
          onRefresh={refresh}
        />
      </TabsContent>
    </Tabs>
  );
}
