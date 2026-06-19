"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PitchingStatsTable } from "@/components/PitchingStatsTable";
import { analyzePitchingStaff } from "@/lib/scouting/pitching-analysis";
import { formatPercent } from "@/lib/utils";
import type { OpponentDetail } from "@/types";

interface PitchingTabProps {
  data: OpponentDetail;
}

export function PitchingTab({ data }: PitchingTabProps) {
  const analyses = useMemo(
    () =>
      analyzePitchingStaff(
        data.extracted_pitching_stats ?? [],
        data.opponent_notes ?? [],
        data.opponent_voice_notes ?? [],
        data.opponent_game_context ?? []
      ),
    [data]
  );

  const mainPitcher = analyses.find((p) =>
    p.roleLabels.includes("Likely Main Pitcher")
  );

  return (
    <div className="space-y-6">
      {analyses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No pitching data yet. Upload box score or pitching stat screenshots in the Evidence tab.
            </p>
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

          <div className="space-y-4">
            <h3 className="font-semibold">Pitching Staff Read</h3>
            {analyses.map((p) => (
              <Card key={p.label}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{p.label}</CardTitle>
                    {p.roleLabels.map((role) => (
                      <Badge key={role} variant="secondary">
                        {role}
                      </Badge>
                    ))}
                    <Badge variant="outline">{p.roleConfidence} confidence</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-xs text-muted-foreground mb-1">Evidence</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {p.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-xs text-muted-foreground mb-1">Pitch Profile</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {p.inningsPitchedDisplay && <span>{p.inningsPitchedDisplay} IP</span>}
                      {p.pitches != null && <span>{p.pitches} pitches</span>}
                      {p.strikes != null && p.balls != null && (
                        <span>{p.strikes}S / {p.balls}B</span>
                      )}
                      {p.strikePercentage != null && (
                        <span>{formatPercent(p.strikePercentage)} strikes</span>
                      )}
                      {p.era != null && <span>ERA {p.era.toFixed(2)}</span>}
                      {p.whip != null && <span>WHIP {p.whip.toFixed(2)}</span>}
                      {p.pitchesPerInning != null && (
                        <span>{p.pitchesPerInning.toFixed(1)} pitches/inning</span>
                      )}
                    </div>
                  </div>
                  <p>
                    <span className="font-medium">Coach Takeaway: </span>
                    {p.coachTakeaway}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pitching Stats Table</CardTitle>
            </CardHeader>
            <CardContent>
              <PitchingStatsTable stats={data.extracted_pitching_stats ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
