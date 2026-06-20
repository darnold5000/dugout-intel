"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildGameDaySummary } from "@/lib/scouting/game-day-summary";
import {
  buildPitcherSummaries,
  buildPitchingLedgerOutlook,
  formatAvailability,
} from "@/lib/scouting/ledger-aggregate";
import { resolveLedgerEntries } from "@/lib/scouting/resolve-ledger";
import type { OpponentDetail, ScoutingReport } from "@/types";
import { Printer } from "lucide-react";

interface GameDayCardProps {
  opponentName: string;
  data: OpponentDetail;
  report: ScoutingReport | null;
}

function SummaryRow({
  label,
  value,
  statBasis,
  confidence,
}: {
  label: string;
  value: string;
  statBasis?: string;
  confidence?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="font-semibold">{value}</p>
      {statBasis && (
        <p className="text-xs text-muted-foreground">Based on {statBasis}</p>
      )}
      {confidence && (
        <p className="text-xs text-muted-foreground">Confidence: {confidence}</p>
      )}
    </div>
  );
}

export function GameDayCard({ opponentName, data, report }: GameDayCardProps) {
  const summary = useMemo(
    () => buildGameDaySummary(opponentName, data),
    [opponentName, data]
  );

  const ledgerOutlook = useMemo(() => {
    const entries = resolveLedgerEntries(data);
    if (!entries.length) return null;
    const summaries = buildPitcherSummaries(entries);
    return buildPitchingLedgerOutlook(summaries);
  }, [data]);

  const reportJson = report?.report_json;
  const gamePlan =
    reportJson?.recommended_game_plan ??
    reportJson?.suggested_game_plan ??
    summary.gamePlan;

  const confidence =
    reportJson?.evidence_and_confidence ??
    reportJson?.confidence_level ??
    summary.confidenceNote;

  return (
    <Card className="border-2 border-primary/30 print:border-black">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Game Day Summary</CardTitle>
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
          60-second read for the parking lot or dugout.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="font-bold text-lg uppercase tracking-wide">{opponentName}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {summary.bestHitter && (
            <SummaryRow
              label={summary.bestHitter.label}
              value={summary.bestHitter.value}
              statBasis={summary.bestHitter.statBasis}
              confidence={summary.bestHitter.confidence}
            />
          )}
          {summary.primaryPitcher && (
            <SummaryRow
              label={summary.primaryPitcher.label}
              value={summary.primaryPitcher.value}
              confidence={summary.primaryPitcher.confidence}
            />
          )}
          {summary.bestRunner && (
            <SummaryRow
              label={summary.bestRunner.label}
              value={summary.bestRunner.value}
              statBasis={summary.bestRunner.statBasis}
            />
          )}
          <SummaryRow
            label="Pitching Depth"
            value={summary.pitchingDepth}
          />
        </div>

        <SummaryRow
          label="Biggest Opportunity"
          value={summary.biggestOpportunity}
        />
        <SummaryRow label="Biggest Threat" value={summary.biggestThreat} />

        {ledgerOutlook && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
              Tomorrow Pitching Outlook
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <SummaryRow
                label="Likely Starter"
                value={ledgerOutlook.likelyStarter?.label ?? "—"}
              />
              <SummaryRow
                label="Likely Closer"
                value={ledgerOutlook.likelyCloser?.label ?? "—"}
              />
              <SummaryRow
                label="Unavailable"
                value={
                  ledgerOutlook.unavailable.length
                    ? ledgerOutlook.unavailable
                        .map(
                          (p) =>
                            `${p.label} (${formatAvailability(p.availability)})`
                        )
                        .join(", ")
                    : "None flagged"
                }
              />
              <SummaryRow
                label="Pitching Depth"
                value={ledgerOutlook.depthRating}
              />
            </div>
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
