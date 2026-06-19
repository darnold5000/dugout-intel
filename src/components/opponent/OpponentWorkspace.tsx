"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/opponent/OverviewTab";
import { EvidenceTab } from "@/components/opponent/EvidenceTab";
import { PitchingTab } from "@/components/opponent/PitchingTab";
import { ReportsTab } from "@/components/opponent/ReportsTab";
import { getAuthHeaders } from "@/lib/auth-headers";
import { evidenceSourceCount } from "@/lib/scouting/evidence-timeline";
import type { OpponentDetail } from "@/types";

interface OpponentWorkspaceProps {
  opponentId: string;
  initialData: OpponentDetail;
}

export function OpponentWorkspace({
  opponentId,
  initialData,
}: OpponentWorkspaceProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab =
    tabParam === "screenshots" || tabParam === "players"
      ? tabParam === "players"
        ? "overview"
        : "evidence"
      : tabParam ?? "overview";
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "screenshots") setActiveTab("evidence");
    else if (tab === "players") setActiveTab("overview");
    else if (tab) setActiveTab(tab);
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

  const evidenceTotal = useMemo(() => evidenceSourceCount(data), [data]);

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
          <TabsTrigger value="pitching" className="flex-1 sm:flex-none">
            Pitching
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-1 sm:flex-none">
            Scouting Report ({data.scouting_reports.length})
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview">
        <OverviewTab data={data} onSwitchTab={setActiveTab} />
      </TabsContent>

      <TabsContent value="evidence">
        <EvidenceTab
          opponentId={opponentId}
          opponentName={data.name}
          data={data}
          onRefresh={refresh}
        />
      </TabsContent>

      <TabsContent value="pitching">
        <PitchingTab data={data} />
      </TabsContent>

      <TabsContent value="report">
        <ReportsTab
          opponentId={opponentId}
          reports={data.scouting_reports}
          onRefresh={refresh}
        />
      </TabsContent>
    </Tabs>
  );
}
