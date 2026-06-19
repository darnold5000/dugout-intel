"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerThreatCard } from "@/components/opponent/PlayerThreatCard";
import { buildPlayerProfiles } from "@/lib/scouting/player-profiles";
import { buildTeamIntelligence } from "@/lib/scouting/team-intelligence";
import { evidenceSourceCount } from "@/lib/scouting/evidence-timeline";
import type { OpponentDetail } from "@/types";
import { ChevronRight, Target, Users } from "lucide-react";

interface OverviewTabProps {
  data: OpponentDetail;
  onSwitchTab: (tab: string) => void;
}

function SnapshotCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
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
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="font-semibold text-sm mt-1">
          {jersey ? `${jersey} ` : ""}
          {name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{stat}</p>
      </CardContent>
    </Card>
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

export function OverviewTab({ data, onSwitchTab }: OverviewTabProps) {
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const profiles = useMemo(() => buildPlayerProfiles(data), [data]);
  const intelligence = useMemo(() => buildTeamIntelligence(data), [data]);

  const pitchersWithStats = profiles.filter(
    (p) => p.pitching?.innings_pitched != null
  ).length;

  const evidenceCount = evidenceSourceCount(data);
  const reportCount = data.scouting_reports?.length ?? 0;

  const hasData =
    profiles.length > 0 ||
    evidenceCount > 0 ||
    data.screenshot_uploads.length > 0;

  const topHitter =
    intelligence.offensiveLeaders.highest_ops ??
    intelligence.offensiveLeaders.highest_avg;
  const topPitcher = intelligence.pitchingLeaders.ace_pitcher;
  const topRunner = intelligence.offensiveLeaders.most_stolen_bases;
  const patientHitter =
    intelligence.offensiveLeaders.highest_obp ??
    intelligence.offensiveLeaders.most_walks;

  const sortedProfiles = useMemo(() => {
    const { tier_1, tier_2, tier_3 } = intelligence.lineupThreatTiers;
    return [...profiles].sort((a, b) => {
      const tierA =
        playerTier(a, tier_1, tier_2, tier_3) ?? 9;
      const tierB =
        playerTier(b, tier_1, tier_2, tier_3) ?? 9;
      if (tierA !== tierB) return tierA - tierB;
      return (b.batting?.ops ?? 0) - (a.batting?.ops ?? 0);
    });
  }, [profiles, intelligence.lineupThreatTiers]);

  const visibleProfiles = showAllPlayers
    ? sortedProfiles
    : sortedProfiles.slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold mb-3">Team Snapshot</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SnapshotCard label="Players" value={profiles.length} />
          <SnapshotCard label="Pitchers" value={pitchersWithStats} />
          <SnapshotCard label="Evidence Sources" value={evidenceCount} />
          <SnapshotCard label="Reports" value={reportCount} />
        </div>
      </section>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">
              Upload screenshots, add notes, or record what you know about this team.
            </p>
            <Button variant="outline" onClick={() => onSwitchTab("evidence")}>
              Add Evidence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {(topHitter || topPitcher || topRunner || patientHitter) && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Top Threats
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                {topRunner &&
                  (intelligence.offensiveLeaders.most_stolen_bases?.stat_line.includes(
                    "SB"
                  ) ??
                    false) && (
                    <ThreatCard
                      title="Best Runner"
                      jersey={
                        topRunner.jersey_number ? `#${topRunner.jersey_number}` : null
                      }
                      name={topRunner.player_name}
                      stat={topRunner.stat_line}
                    />
                  )}
                {patientHitter && (
                  <ThreatCard
                    title="Most Patient Hitter"
                    jersey={
                      patientHitter.jersey_number
                        ? `#${patientHitter.jersey_number}`
                        : null
                    }
                    name={patientHitter.player_name}
                    stat={patientHitter.stat_line}
                  />
                )}
              </div>
            </section>
          )}

          {intelligence.teamIdentity && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Team Identity</h2>
              <Card>
                <CardContent className="pt-4 pb-4 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {intelligence.teamIdentity.offensive_strength}
                  </Badge>
                  <Badge variant="outline">
                    Power: {intelligence.teamIdentity.power}
                  </Badge>
                  <Badge variant="outline">
                    Speed: {intelligence.teamIdentity.speed}
                  </Badge>
                  <Badge variant="outline">
                    Patience: {intelligence.teamIdentity.patience}
                  </Badge>
                  <Badge variant="outline">
                    {intelligence.teamIdentity.pitching_depth}
                  </Badge>
                </CardContent>
              </Card>
            </section>
          )}

          {profiles.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Players Preview
                </h2>
                {sortedProfiles.length > PREVIEW_COUNT && !showAllPlayers && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowAllPlayers(true)}
                  >
                    View All Players
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
              {showAllPlayers && sortedProfiles.length > PREVIEW_COUNT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => setShowAllPlayers(false)}
                >
                  Show fewer players
                </Button>
              )}
            </section>
          )}

          {intelligence.dataGaps.length > 0 && (
            <section>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">What We Still Need</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {intelligence.dataGaps.map((gap, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      • {gap}
                    </p>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
