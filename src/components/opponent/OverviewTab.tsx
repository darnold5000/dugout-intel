"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RebuildStatsButton } from "@/components/opponent/RebuildStatsButton";
import {
  buildPlayerProfiles,
  formatPlayerLabel,
  battingSummary,
  pitchingSummary,
} from "@/lib/scouting/player-profiles";
import { buildTeamIntelligence } from "@/lib/scouting/team-intelligence";
import { formatDate } from "@/lib/utils";
import type { OpponentDetail } from "@/types";
import { ChevronDown, ChevronRight, Sparkles, Trophy } from "lucide-react";

interface OverviewTabProps {
  data: OpponentDetail;
  onRefresh: () => Promise<void>;
  onSwitchTab: (tab: string) => void;
}

function LeaderCard({
  title,
  player,
  stat,
}: {
  title: string;
  player: string;
  stat: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="font-semibold text-sm mt-1 truncate">{player}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{stat}</p>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({ data, onRefresh, onSwitchTab }: OverviewTabProps) {
  const [showMergeDiagnostics, setShowMergeDiagnostics] = useState(false);
  const [diagMessage, setDiagMessage] = useState("");
  const [showRawData, setShowRawData] = useState(false);

  const profiles = useMemo(() => buildPlayerProfiles(data), [data]);
  const intelligence = useMemo(() => buildTeamIntelligence(data), [data]);

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

  const topHitter = intelligence.offensiveLeaders.highest_ops ?? intelligence.offensiveLeaders.highest_avg;
  const topPitcher = intelligence.pitchingLeaders.ace_pitcher;
  const topRunner = intelligence.offensiveLeaders.most_stolen_bases;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Players</p>
            <p className="text-2xl font-semibold">{profiles.length}</p>
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

      {hasData && (topHitter || topPitcher || topRunner) && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Team Leaders
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topHitter && (
              <LeaderCard
                title="Top Hitter"
                player={`${topHitter.jersey_number ? `#${topHitter.jersey_number} ` : ""}${topHitter.player_name}`}
                stat={topHitter.stat_line}
              />
            )}
            {topPitcher && (
              <LeaderCard
                title="Top Pitcher"
                player={`${topPitcher.jersey_number ? `#${topPitcher.jersey_number} ` : ""}${topPitcher.player_name}`}
                stat={topPitcher.stat_line}
              />
            )}
            {topRunner && (intelligence.baseRunningThreats[0]?.stat_line.includes("SB") ?? false) && (
              <LeaderCard
                title="Top Runner"
                player={`${topRunner.jersey_number ? `#${topRunner.jersey_number} ` : ""}${topRunner.player_name}`}
                stat={topRunner.stat_line}
              />
            )}
          </div>
        </div>
      )}

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
          {intelligence.teamIdentity && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Team Identity</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="outline">{intelligence.teamIdentity.offensive_strength}</Badge>
                <Badge variant="outline">Power: {intelligence.teamIdentity.power}</Badge>
                <Badge variant="outline">Speed: {intelligence.teamIdentity.speed}</Badge>
                <Badge variant="outline">Patience: {intelligence.teamIdentity.patience}</Badge>
                <Badge variant="outline">{intelligence.teamIdentity.pitching_depth}</Badge>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Consolidated Players ({profiles.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground font-normal">
                One row per player — duplicates merged across screenshots.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {profiles.map((profile) => (
                <div
                  key={profile.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b last:border-0 text-sm"
                >
                  <span className="font-medium">{formatPlayerLabel(profile)}</span>
                  <span className="text-xs text-muted-foreground">
                    {profile.batting ? battingSummary(profile) : ""}
                    {profile.batting && profile.pitching ? " · " : ""}
                    {profile.pitching ? pitchingSummary(profile) : ""}
                    {!profile.batting && !profile.pitching ? "Roster only" : ""}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {intelligence.dataGaps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Data Gaps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {intelligence.dataGaps.map((gap, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    • {gap}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setShowRawData((v) => !v)}
              >
                {showRawData ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <CardTitle className="text-base">Raw Screenshot Data</CardTitle>
                <span className="text-xs text-muted-foreground font-normal ml-auto">
                  Collapsed by default
                </span>
              </button>
            </CardHeader>
            {showRawData && (
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {battersWithStats} batters · {pitchersWithStats} pitchers ·{" "}
                  {data.extracted_games.length} games in database.
                </p>
                <p>
                  View individual screenshot tables on the Screenshots tab.
                </p>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
