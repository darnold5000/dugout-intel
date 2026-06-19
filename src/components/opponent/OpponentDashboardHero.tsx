"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildOpponentDashboardSummary } from "@/lib/scouting/opponent-dashboard";
import type { OpponentDetail } from "@/types";

interface OpponentDashboardHeroProps {
  data: OpponentDetail;
}

export function OpponentDashboardHero({ data }: OpponentDashboardHeroProps) {
  const summary = useMemo(() => buildOpponentDashboardSummary(data), [data]);

  const threatVariant =
    summary.overallThreat === "High"
      ? "destructive"
      : summary.overallThreat === "Low"
        ? "secondary"
        : "default";

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="text-lg font-bold tracking-tight uppercase">
            {data.name}
          </h2>
          <Badge variant={threatVariant as "default" | "secondary" | "destructive"}>
            Overall Threat: {summary.overallThreat}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Primary Pitcher</p>
            <p className="font-semibold mt-0.5">
              {summary.primaryPitcher ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Best Hitter</p>
            <p className="font-semibold mt-0.5">{summary.bestHitter ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Best Runner</p>
            <p className="font-semibold mt-0.5">{summary.bestRunner ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pitching Depth</p>
            <p className="font-semibold mt-0.5">{summary.pitchingDepth}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Scouted</p>
            <p className="font-semibold mt-0.5">
              {summary.lastScouted ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Scout Notes</p>
            <p className="font-semibold mt-0.5">{summary.scoutNotesCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
