"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RebuildStatsButton } from "@/components/opponent/RebuildStatsButton";
import { BattingStatsTable } from "@/components/BattingStatsTable";
import { PitchingStatsTable } from "@/components/PitchingStatsTable";
import {
  buildPlayerProfiles,
  buildScoutingInsights,
  collectDataGaps,
  formatPlayerLabel,
  battingSummary,
  pitchingSummary,
} from "@/lib/scouting/player-profiles";
import { formatDate } from "@/lib/utils";
import type { OpponentDetail } from "@/types";
import { Sparkles } from "lucide-react";

interface OverviewTabProps {
  data: OpponentDetail;
  onRefresh: () => Promise<void>;
  onSwitchTab: (tab: string) => void;
}

function InsightList({
  title,
  profiles,
  renderLine,
}: {
  title: string;
  profiles: ReturnType<typeof buildPlayerProfiles>;
  renderLine: (p: (typeof profiles)[number]) => string;
}) {
  if (profiles.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {profiles.map((profile) => (
          <div key={profile.key} className="text-sm">
            <p className="font-medium">{formatPlayerLabel(profile)}</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {renderLine(profile)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OverviewTab({ data, onRefresh, onSwitchTab }: OverviewTabProps) {
  const [showMergeDiagnostics, setShowMergeDiagnostics] = useState(false);
  const [diagMessage, setDiagMessage] = useState("");

  const profiles = useMemo(() => buildPlayerProfiles(data), [data]);
  const insights = useMemo(() => buildScoutingInsights(profiles), [profiles]);
  const dataGaps = useMemo(
    () => [...insights.dataGaps, ...collectDataGaps(data.screenshot_uploads, profiles)],
    [insights.dataGaps, data.screenshot_uploads, profiles]
  );

  const lastUpdated = useMemo(() => {
    const dates = data.screenshot_uploads.map((u) => u.created_at);
    if (!dates.length) return null;
    return dates.sort().reverse()[0];
  }, [data.screenshot_uploads]);

  const battersWithStats = profiles.filter((p) => p.batting).length;
  const pitchersWithStats = profiles.filter(
    (p) => p.pitching?.innings_pitched != null
  ).length;

  const hasData = profiles.length > 0 || data.screenshot_uploads.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Players Found</p>
            <p className="text-2xl font-semibold">{profiles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Batters</p>
            <p className="text-2xl font-semibold">{battersWithStats}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Pitchers</p>
            <p className="text-2xl font-semibold">{pitchersWithStats}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Screenshots</p>
            <p className="text-2xl font-semibold">{data.screenshot_uploads.length}</p>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Updated {formatDate(lastUpdated)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => onSwitchTab("report")} size="lg" className="sm:flex-1">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Scouting Report
        </Button>
        <RebuildStatsButton
          opponentId={data.id}
          onComplete={onRefresh}
          showDiagnostics={showMergeDiagnostics}
          onDiagnostics={setDiagMessage}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showMergeDiagnostics}
            onChange={(e) => setShowMergeDiagnostics(e.target.checked)}
            className="rounded"
          />
          Show Merge Diagnostics (dev)
        </label>
      </div>
      {showMergeDiagnostics && diagMessage && (
        <p className="text-xs text-muted-foreground font-mono">{diagMessage}</p>
      )}

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">
              Upload GameChanger screenshots to build your opponent scouting profile.
            </p>
            <Button variant="outline" onClick={() => onSwitchTab("screenshots")}>
              Go to Screenshots
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightList
              title="Top Hitters"
              profiles={insights.topHitters}
              renderLine={battingSummary}
            />
            <InsightList
              title="On-Base Threats"
              profiles={insights.onBaseThreats}
              renderLine={(p) =>
                p.batting?.obp != null
                  ? `OBP ${p.batting.obp.toFixed(3)}`
                  : battingSummary(p)
              }
            />
            <InsightList
              title="Power / Production"
              profiles={insights.powerProduction}
              renderLine={(p) => {
                const parts: string[] = [];
                if (p.batting?.ops != null) parts.push(`OPS ${p.batting.ops.toFixed(3)}`);
                if (p.batting?.rbi != null) parts.push(`RBI ${p.batting.rbi}`);
                return parts.join(" | ") || battingSummary(p);
              }}
            />
            <InsightList
              title="Speed Threats"
              profiles={insights.speedThreats}
              renderLine={(p) =>
                p.batting?.stolen_bases != null
                  ? `${p.batting.stolen_bases} SB`
                  : battingSummary(p)
              }
            />
            <InsightList
              title="Pitchers to Know"
              profiles={insights.pitchersToKnow}
              renderLine={pitchingSummary}
            />
            <InsightList
              title="Possible Weak Spots"
              profiles={insights.weakSpots}
              renderLine={battingSummary}
            />
          </div>

          {dataGaps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Data Gaps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {dataGaps.map((gap, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    • {gap}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {data.extracted_batting_stats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Batting Leaders</CardTitle>
              </CardHeader>
              <CardContent>
                <BattingStatsTable stats={data.extracted_batting_stats} />
              </CardContent>
            </Card>
          )}

          {data.extracted_pitching_stats.some(
            (s) => s.innings_pitched != null
          ) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pitching Staff</CardTitle>
              </CardHeader>
              <CardContent>
                <PitchingStatsTable stats={data.extracted_pitching_stats} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
