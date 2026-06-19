"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildCoachTakeaways } from "@/lib/scouting/coach-takeaways";
import { analyzePitchingStaff } from "@/lib/scouting/pitching-analysis";
import { buildTeamIntelligence } from "@/lib/scouting/team-intelligence";
import type { OpponentDetail, ScoutingReport } from "@/types";
import { Printer } from "lucide-react";

interface GameDayCardProps {
  opponentName: string;
  data: OpponentDetail;
  report: ScoutingReport | null;
}

export function GameDayCard({ opponentName, data, report }: GameDayCardProps) {
  const intelligence = useMemo(() => buildTeamIntelligence(data), [data]);
  const pitching = useMemo(
    () =>
      analyzePitchingStaff(
        data.extracted_pitching_stats ?? [],
        data.opponent_notes ?? [],
        data.opponent_voice_notes ?? [],
        data.opponent_game_context ?? []
      ),
    [data]
  );
  const takeaways = useMemo(
    () => buildCoachTakeaways(data, intelligence, pitching),
    [data, intelligence, pitching]
  );

  const topThreats = [
    intelligence.offensiveLeaders.highest_ops ??
      intelligence.offensiveLeaders.highest_avg,
    intelligence.pitchingLeaders.ace_pitcher,
    intelligence.offensiveLeaders.most_stolen_bases,
  ]
    .filter(Boolean)
    .slice(0, 3)
    .map((p) =>
      p!.jersey_number ? `#${p!.jersey_number} ${p!.player_name}` : p!.player_name
    );

  const reportJson = report?.report_json;
  const gamePlan =
    reportJson?.recommended_game_plan ??
    reportJson?.suggested_game_plan ??
    takeaways.slice(0, 3).map((t) => `• ${t}`).join("\n");

  const confidence =
    reportJson?.evidence_and_confidence ??
    reportJson?.confidence_level ??
    "Based on available scout notes";

  return (
    <Card className="border-2 border-primary/30 print:border-black">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Game Day Card</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="no-print"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          30-second read for the parking lot or dugout.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="font-bold text-lg uppercase tracking-wide">{opponentName}</p>

        {topThreats.length > 0 && (
          <div>
            <p className="font-semibold text-xs text-muted-foreground mb-1">
              TOP THREATS
            </p>
            <ul className="space-y-0.5 font-medium">
              {topThreats.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {pitching.length > 0 && (
          <div>
            <p className="font-semibold text-xs text-muted-foreground mb-1">
              PITCHING
            </p>
            <p>{takeaways.find((t) => t.includes("innings")) ?? takeaways[0]}</p>
          </div>
        )}

        <div>
          <p className="font-semibold text-xs text-muted-foreground mb-1">
            GAME PLAN
          </p>
          <p className="whitespace-pre-wrap">{gamePlan}</p>
        </div>

        <div>
          <p className="font-semibold text-xs text-muted-foreground mb-1">
            CONFIDENCE
          </p>
          <p>{confidence}</p>
        </div>
      </CardContent>
    </Card>
  );
}
