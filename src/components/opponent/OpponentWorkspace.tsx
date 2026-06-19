"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/opponent/OverviewTab";
import { ScoutNotesTab } from "@/components/opponent/EvidenceTab";
import { PitchingTab } from "@/components/opponent/PitchingTab";
import { ReportsTab } from "@/components/opponent/ReportsTab";
import { OpponentDashboardHero } from "@/components/opponent/OpponentDashboardHero";
import { getAuthHeaders } from "@/lib/auth-headers";
import { scoutNotesCount } from "@/lib/scouting/evidence-timeline";
import type { OpponentDetail } from "@/types";

interface OpponentWorkspaceProps {
  opponentId: string;
  initialData: OpponentDetail;
}

function resolveTab(tab: string | null): string {
  if (!tab || tab === "overview") return "overview";
  if (tab === "screenshots" || tab === "evidence") return "scout-notes";
  if (tab === "players") return "overview";
  return tab;
}

export function OpponentWorkspace({
  opponentId,
  initialData,
}: OpponentWorkspaceProps) {
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState(() =>
    resolveTab(searchParams.get("tab"))
  );

  useEffect(() => {
    setActiveTab(resolveTab(searchParams.get("tab")));
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

  const notesTotal = useMemo(() => scoutNotesCount(data), [data]);

  return (
    <>
      <OpponentDashboardHero data={data} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 -mx-1 px-1">
          <TabsList className="w-full flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="overview" className="flex-1 sm:flex-none">
              Overview
            </TabsTrigger>
            <TabsTrigger value="scout-notes" className="flex-1 sm:flex-none">
              Scout Notes ({notesTotal})
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
            opponentName={data.name}
            data={data}
            onSwitchTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="scout-notes">
          <ScoutNotesTab
            opponentId={opponentId}
            opponentName={data.name}
            data={data}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="pitching">
          <PitchingTab data={data} onSwitchTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="report">
          <ReportsTab
            opponentId={opponentId}
            opponentName={data.name}
            data={data}
            reports={data.scouting_reports}
            onRefresh={refresh}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
