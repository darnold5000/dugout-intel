"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/opponent/OverviewTab";
import { PlayersTab } from "@/components/opponent/PlayersTab";
import { ReportsTab } from "@/components/opponent/ReportsTab";
import { ScreenshotsTab } from "@/components/opponent/ScreenshotsTab";
import { getAuthHeaders } from "@/lib/auth-headers";
import { buildPlayerProfiles } from "@/lib/scouting/player-profiles";
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
  const defaultTab = searchParams.get("tab") ?? "overview";
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 -mx-1 px-1">
        <TabsList className="w-full flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">
            Overview
          </TabsTrigger>
          <TabsTrigger value="players" className="flex-1 sm:flex-none">
            Players ({playerCount})
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-1 sm:flex-none">
            Scouting Report ({data.scouting_reports.length})
          </TabsTrigger>
          <TabsTrigger value="screenshots" className="flex-1 sm:flex-none">
            Screenshots ({data.screenshot_uploads.length})
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

      <TabsContent value="players">
        <PlayersTab data={data} onRefresh={refresh} />
      </TabsContent>

      <TabsContent value="report">
        <ReportsTab
          opponentId={opponentId}
          reports={data.scouting_reports}
          onRefresh={refresh}
        />
      </TabsContent>

      <TabsContent value="screenshots">
        <ScreenshotsTab
          opponentId={opponentId}
          opponentName={data.name}
          uploads={data.screenshot_uploads}
          onRefresh={refresh}
        />
      </TabsContent>
    </Tabs>
  );
}
