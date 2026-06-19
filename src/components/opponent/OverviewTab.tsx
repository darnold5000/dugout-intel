"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerThreatCard } from "@/components/opponent/PlayerThreatCard";
import { buildPlayerProfiles } from "@/lib/scouting/player-profiles";
import {
  resolveBestHitterPick,
  resolveBestRunnerPick,
} from "@/lib/scouting/offensive-leaders";
import { buildTeamIntelligence } from "@/lib/scouting/team-intelligence";
import { buildCoachTakeaways } from "@/lib/scouting/coach-takeaways";
import { analyzePitchingStaffFromDetail } from "@/lib/scouting/pitching-analysis";
import { GameDayCard } from "@/components/opponent/GameDayCard";
import { scoutNotesCount } from "@/lib/scouting/evidence-timeline";
import { buildRecentGames } from "@/lib/scouting/game-results";
import { RecentGamesSection } from "@/components/opponent/RecentGamesSection";
import type { OpponentDetail } from "@/types";
import { Check, ChevronRight, Target, Users } from "lucide-react";

interface OverviewTabProps {
  opponentName: string;
  data: OpponentDetail;
  onSwitchTab: (tab: string) => void;
}

function CompactStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center px-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}

function ThreatCard({
  title,
  jersey,
  name,
  stat,
}: {
  title: string;
  jersey: string | null;
  name: string;
  stat: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className="font-semibold text-sm mt-0.5">
        {jersey ? `#${jersey.replace(/^#/, "")} ` : ""}
        {name}
      </p>
      <p className="text-xs text-muted-foreground">{stat}</p>
    </div>
  );
}

function playerTier(
  profile: ReturnType<typeof buildPlayerProfiles>[number],
  tier1: string[],
  tier2: string[],
  tier3: string[]
): 1 | 2 | 3 | null {
  const label = profile.jerseyNumber
    ? `#${profile.jerseyNumber} ${profile.name ?? ""}`.trim()
    : (profile.name ?? "");
  if (tier1.some((t) => t.includes(profile.name ?? "") || t === label)) return 1;
  if (tier2.some((t) => t.includes(profile.name ?? "") || t === label)) return 2;
  if (tier3.some((t) => t.includes(profile.name ?? "") || t === label)) return 3;
  return null;
}

const PREVIEW_COUNT = 8;

export function OverviewTab({ opponentName, data, onSwitchTab }: OverviewTabProps) {
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const profiles = useMemo(() => buildPlayerProfiles(data), [data]);
  const intelligence = useMemo(() => buildTeamIntelligence(data), [data]);
  const pitchingAnalyses = useMemo(
    () => analyzePitchingStaffFromDetail(data),
    [data]
  );
  const takeaways = useMemo(
    () => buildCoachTakeaways(data, intelligence, pitchingAnalyses),
    [data, intelligence, pitchingAnalyses]
  );
  const recentGames = useMemo(() => buildRecentGames(data), [data]);

  const pitchersWithStats = profiles.filter(
    (p) => p.pitching?.innings_pitched != null
  ).length;
  const notesCount = scoutNotesCount(data);
  const reportCount = data.scouting_reports?.length ?? 0;
  const hasData =
    profiles.length > 0 || notesCount > 0 || data.screenshot_uploads.length > 0;

  const topHitterPick = useMemo(
    () => resolveBestHitterPick(profiles),
    [profiles]
  );
  const topRunnerPick = useMemo(
    () => resolveBestRunnerPick(profiles),
    [profiles]
  );

  const topHitter = topHitterPick
    ? {
        jersey_number: topHitterPick.jersey_number,
        player_name: topHitterPick.player_name,
        stat_line: topHitterPick.stat_line,
      }
    : intelligence.offensiveLeaders.highest_ops ??
      intelligence.offensiveLeaders.highest_avg;
  const topPitcher = intelligence.pitchingLeaders.ace_pitcher;
  const topRunner = topRunnerPick
    ? {
        jersey_number: topRunnerPick.jersey_number,
        player_name: topRunnerPick.player_name,
        stat_line: topRunnerPick.stat_line,
      }
    : intelligence.offensiveLeaders.most_stolen_bases;
  const strikeThrower = intelligence.pitchingLeaders.strike_thrower;
  const pitchCountLeader = intelligence.pitchCountLeaders?.[0];
  const highLeverageArm = pitchingAnalyses.find((p) =>
    p.roleLabels.includes("High-Leverage Arm")
  );

  const sortedProfiles = useMemo(() => {
    const { tier_1, tier_2, tier_3 } = intelligence.lineupThreatTiers;
    return [...profiles].sort((a, b) => {
      const tierA = playerTier(a, tier_1, tier_2, tier_3) ?? 9;
      const tierB = playerTier(b, tier_1, tier_2, tier_3) ?? 9;
      if (tierA !== tierB) return tierA - tierB;
      return (b.batting?.ops ?? 0) - (a.batting?.ops ?? 0);
    });
  }, [profiles, intelligence.lineupThreatTiers]);

  const visibleProfiles = showAllPlayers
    ? sortedProfiles
    : sortedProfiles.slice(0, PREVIEW_COUNT);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-muted-foreground">
            Upload screenshots or add scout notes to see team insights.
          </p>
          <Button variant="outline" onClick={() => onSwitchTab("scout-notes")}>
            Add Scout Notes
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <GameDayCard opponentName={opponentName} data={data} report={null} />

      {/* Above the fold: 60-second coach view */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-2 mb-4 border-b pb-4">
            <CompactStat label="Players" value={profiles.length} />
            <CompactStat label="Pitchers" value={pitchersWithStats} />
            <CompactStat label="Notes" value={notesCount} />
            <CompactStat label="Reports" value={reportCount} />
          </div>

          <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Target className="h-3.5 w-3.5" />
            Top Threats
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {topHitter && (
              <ThreatCard
                title="Best Hitter"
                jersey={
                  topHitter.jersey_number ? `#${topHitter.jersey_number}` : null
                }
                name={topHitter.player_name}
                stat={topHitter.stat_line}
              />
            )}
            {topPitcher && (
              <ThreatCard
                title="Best Pitcher"
                jersey={
                  topPitcher.jersey_number ? `#${topPitcher.jersey_number}` : null
                }
                name={topPitcher.player_name}
                stat={topPitcher.stat_line}
              />
            )}
            {topRunner && (
                <ThreatCard
                  title="Best Runner"
                  jersey={
                    topRunner.jersey_number ? `#${topRunner.jersey_number}` : null
                  }
                  name={topRunner.player_name}
                  stat={topRunner.stat_line}
                />
              )}
          </div>

          {intelligence.teamIdentity && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {intelligence.teamIdentity.offensive_strength}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Speed: {intelligence.teamIdentity.speed}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Patience: {intelligence.teamIdentity.patience}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {intelligence.teamIdentity.pitching_depth}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {(recentGames.length > 0 || data.screenshot_uploads.length > 0) && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">
            Recent Games
          </h3>
          <RecentGamesSection games={recentGames} />
        </section>
      )}

      {/* Pitching before players */}
      {pitchingAnalyses.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">
            Pitching Snapshot
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {topPitcher && (
              <ThreatCard
                title="Top Pitcher"
                jersey={
                  topPitcher.jersey_number ? `#${topPitcher.jersey_number}` : null
                }
                name={topPitcher.player_name}
                stat={topPitcher.stat_line}
              />
            )}
            <div className="rounded-lg border bg-card px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Pitching Depth</p>
              <p className="font-semibold text-sm mt-0.5">
                {intelligence.teamIdentity?.pitching_depth ?? "Unknown"}
              </p>
            </div>
            {pitchCountLeader && (
              <ThreatCard
                title="Pitch Count Leader"
                jersey={
                  pitchCountLeader.jersey_number
                    ? `#${pitchCountLeader.jersey_number}`
                    : null
                }
                name={pitchCountLeader.player_name}
                stat={pitchCountLeader.stat_line}
              />
            )}
            {strikeThrower && (
              <ThreatCard
                title="Strike Thrower"
                jersey={
                  strikeThrower.jersey_number
                    ? `#${strikeThrower.jersey_number}`
                    : null
                }
                name={strikeThrower.player_name}
                stat={strikeThrower.stat_line}
              />
            )}
            {highLeverageArm && (
              <ThreatCard
                title="High-Leverage Arm"
                jersey={
                  highLeverageArm.jerseyNumber
                    ? `#${highLeverageArm.jerseyNumber}`
                    : null
                }
                name={highLeverageArm.playerName ?? highLeverageArm.label}
                stat={highLeverageArm.likelyUsage}
              />
            )}
          </div>
        </section>
      )}

      {takeaways.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">
            Coach Takeaways
          </h3>
          <Card>
            <CardContent className="py-3 space-y-2">
              {takeaways.map((t, i) => (
                <p key={i} className="text-sm flex gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{t}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {profiles.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Players To Watch
            </h3>
            {sortedProfiles.length > PREVIEW_COUNT && !showAllPlayers && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowAllPlayers(true)}
              >
                View All
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {visibleProfiles.map((profile) => (
              <PlayerThreatCard
                key={profile.key}
                profile={profile}
                tier={playerTier(
                  profile,
                  intelligence.lineupThreatTiers.tier_1,
                  intelligence.lineupThreatTiers.tier_2,
                  intelligence.lineupThreatTiers.tier_3
                )}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
