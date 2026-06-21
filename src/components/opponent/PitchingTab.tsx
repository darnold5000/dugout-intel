"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PitchingStatsTable } from "@/components/PitchingStatsTable";
import {
  analyzePitchingStaffFromDetail,
} from "@/lib/scouting/pitching-analysis";
import { getConsolidatedPitchingStats } from "@/lib/scouting/player-profiles";
import { formatPercent, formatPitchStrikes } from "@/lib/utils";
import type { OpponentDetail } from "@/types";

interface PitchingTabProps {
  data: OpponentDetail;
  onSwitchTab?: (tab: string) => void;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function PitchingTab({ data, onSwitchTab }: PitchingTabProps) {
  const analyses = useMemo(() => analyzePitchingStaffFromDetail(data), [data]);
  const consolidatedStats = useMemo(
    () => getConsolidatedPitchingStats(data),
    [data]
  );

  const mainPitcher = analyses.find((p) =>
    p.roleLabels.includes("Likely Main Pitcher")
  );

  return (
    <div className="space-y-6">
      {analyses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">
              No pitching data yet. Add box scores or pitching stat screenshots in
              Scout Notes.
            </p>
            {onSwitchTab && (
              <Button variant="outline" onClick={() => onSwitchTab("scout-notes")}>
                Go to Scout Notes
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {mainPitcher && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Likely Main Pitcher</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{mainPitcher.label}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {mainPitcher.coachTakeaway}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
              <h3 className="font-semibold text-sm">Pitching Staff</h3>
              {analyses.map((p) => (
                <Card key={`${p.jerseyNumber ?? "x"}-${p.playerName ?? p.label}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{p.label}</CardTitle>
                      {p.roleLabels.map((role) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-muted/40 p-3">
                      <ProfileRow label="Role" value={p.role} />
                      <ProfileRow label="Workload" value={p.workload} />
                      <ProfileRow
                        label="Strike Thrower"
                        value={p.strikeThrower ? "Yes" : "No"}
                      />
                      <ProfileRow label="Control Risk" value={p.controlRisk} />
                      <ProfileRow
                        label="Likely Usage"
                        value={p.likelyUsage}
                      />
                    </div>

                    <div>
                      <p className="font-medium text-xs text-muted-foreground mb-1">
                        Pitch Profile
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {p.inningsPitchedDisplay && (
                          <span>{p.inningsPitchedDisplay} IP</span>
                        )}
                        {p.pitchStrikesLine ? (
                          <span>{p.pitchStrikesLine} P-S</span>
                        ) : (
                          p.pitches != null && <span>{p.pitches} pitches</span>
                        )}
                        {!p.pitchStrikesLine &&
                          p.strikes != null &&
                          p.balls != null && (
                            <span>
                              {p.strikes}S / {p.balls}B
                            </span>
                          )}
                        {p.strikePercentage != null && (
                          <span>{formatPercent(p.strikePercentage)} strikes</span>
                        )}
                        {p.era != null && <span>ERA {p.era.toFixed(2)}</span>}
                      </div>
                    </div>

                    {p.evidence.length > 0 && (
                      <div>
                        <p className="font-medium text-xs text-muted-foreground mb-1">
                          Evidence Sources Used
                        </p>
                        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                          {p.evidence.slice(0, 4).map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-sm">
                      <span className="font-medium">How To Attack: </span>
                      {p.coachTakeaway}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="lg:col-span-2 order-1 lg:order-2">
              <CardHeader>
                <CardTitle className="text-base">Pitching Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <PitchingStatsTable stats={consolidatedStats} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
