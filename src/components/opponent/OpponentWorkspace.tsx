"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenshotsTab } from "@/components/opponent/ScreenshotsTab";
import { ExtractedDataTab } from "@/components/opponent/ExtractedDataTab";
import { ReportsTab } from "@/components/opponent/ReportsTab";
import { getAuthHeaders } from "@/lib/auth-headers";
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
  const defaultTab = searchParams.get("tab") ?? "screenshots";
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="screenshots">
          Screenshots ({data.screenshot_uploads.length})
        </TabsTrigger>
        <TabsTrigger value="data">
          Extracted Data (
          {data.extracted_players.length +
            data.extracted_batting_stats.length +
            data.extracted_pitching_stats.length +
            data.extracted_games.length}
          )
        </TabsTrigger>
        <TabsTrigger value="reports">
          Reports ({data.scouting_reports.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="screenshots">
        <ScreenshotsTab
          opponentId={opponentId}
          opponentName={data.name}
          uploads={data.screenshot_uploads}
          onRefresh={refresh}
        />
      </TabsContent>

      <TabsContent value="data">
        <ExtractedDataTab data={data} onRefresh={refresh} />
      </TabsContent>

      <TabsContent value="reports">
        <ReportsTab
          opponentId={opponentId}
          reports={data.scouting_reports}
          onRefresh={refresh}
        />
      </TabsContent>
    </Tabs>
  );
}
