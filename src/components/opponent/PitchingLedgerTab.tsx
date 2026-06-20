"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildPitcherSummaries,
  buildPitchingLedgerOutlook,
  formatAvailability,
  formatAvailabilityWindowLabel,
  formatGameTypeLabel,
  resolveAvailabilityWindow,
} from "@/lib/scouting/ledger-aggregate";
import { resolveLedgerEntries } from "@/lib/scouting/resolve-ledger";
import { formatPitchingRulesBlurb } from "@/lib/scouting/pitching-rules";
import { formatDate, formatStat } from "@/lib/utils";
import type { OpponentDetail, PitcherLedgerSummary } from "@/types";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface PitchingLedgerTabProps {
  data: OpponentDetail;
  onSwitchTab?: (tab: string) => void;
}

function availabilityVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "unavailable") return "destructive";
  if (status === "limited" || status === "emergency_only") return "secondary";
  return "outline";
}

function WorkloadBar({ innings, max = 6 }: { innings: number; max?: number }) {
  const filled = Math.min(6, Math.round((innings / max) * 6));
  return (
    <span className="font-mono text-xs tracking-widest" aria-hidden>
      {"█".repeat(filled)}
      {"░".repeat(6 - filled)}
    </span>
  );
}

function PitchingRulesBlurb() {
  const { profileLabel, intro, bullets } = formatPitchingRulesBlurb();

  return (
    <Card className="border-muted bg-muted/20">
      <CardContent className="pt-4 pb-4">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Availability Rules — {profileLabel}
            </p>
            <p className="text-sm text-muted-foreground">{intro}</p>
            <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
              {bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PitcherLedgerCard({ summary }: { summary: PitcherLedgerSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{summary.label}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Importance {summary.importanceScore}/100 ·{" "}
              {summary.importanceAssessment}
            </p>
          </div>
          <Badge variant={availabilityVariant(summary.availability)}>
            {formatAvailability(summary.availability)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Total IP</p>
            <p className="font-semibold">{formatStat(summary.totalInnings, 1)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pitches</p>
            <p className="font-semibold">{summary.totalPitches || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bracket</p>
            <p className="font-semibold">{summary.bracketAppearances} games</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining est.</p>
            <p className="font-semibold">
              {summary.remainingInningsEstimate != null
                ? `${formatStat(summary.remainingInningsEstimate, 1)} IP`
                : "—"}
            </p>
          </div>
        </div>

        {summary.roleLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {summary.roleLabels.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">
                {role}
              </Badge>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setOpen((v) => !v)}
        >
          Tournament Timeline
          {open ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </Button>

        {open && (
          <div className="space-y-3 border-t pt-3">
            {summary.appearances.map((app) => (
              <div
                key={app.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm border-l-2 border-primary/30 pl-3"
              >
                <div>
                  <p className="font-medium">
                    {app.game_date ? formatDate(app.game_date) : "Unknown date"}
                    {app.opponent_played ? ` vs ${app.opponent_played}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatGameTypeLabel(app.game_type)}
                    {app.tournament_name ? ` · ${app.tournament_name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>
                    {app.innings_pitched != null
                      ? `${formatStat(app.innings_pitched, 1)} IP`
                      : "— IP"}
                  </span>
                  {app.pitch_count != null && <span>{app.pitch_count} pitches</span>}
                  <WorkloadBar
                    innings={app.innings_pitched ?? 0}
                  />
                  <Badge variant="outline" className="text-[10px]">
                    {app.leverage} leverage
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PitchingLedgerTab({
  data,
  onSwitchTab,
}: PitchingLedgerTabProps) {
  const entries = useMemo(() => resolveLedgerEntries(data), [data]);
  const availabilityWindow = useMemo(() => resolveAvailabilityWindow(), []);
  const summaries = useMemo(
    () => buildPitcherSummaries(entries),
    [entries]
  );
  const outlook = useMemo(
    () => buildPitchingLedgerOutlook(summaries),
    [summaries]
  );

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">
              No tournament pitching ledger yet. Upload box scores with game dates
              and opponent names in Scout Notes — each game builds a workload
              entry per pitcher.
            </p>
            {onSwitchTab && (
              <Button variant="outline" onClick={() => onSwitchTab("scout-notes")}>
                Go to Scout Notes
              </Button>
            )}
          </CardContent>
        </Card>
        <PitchingRulesBlurb />
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="space-y-4">
        <PitchingRulesBlurb />
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">
              {formatAvailabilityWindowLabel(availabilityWindow)} No pitcher
              appearances fall in that window — add game dates to recent uploads
              or check that dates match the current weekend.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PitchingRulesBlurb />
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tomorrow&apos;s Pitching Outlook</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            {formatAvailabilityWindowLabel(availabilityWindow)}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Ace</p>
            <p className="font-semibold">{outlook.ace?.label ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Likely Starter</p>
            <p className="font-semibold">
              {outlook.likelyStarter?.label ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Primary Relief</p>
            <p className="font-semibold">
              {outlook.primaryRelief?.label ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Likely Closer</p>
            <p className="font-semibold">
              {outlook.likelyCloser?.label ?? "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Unavailable</p>
            <p className="font-medium">
              {outlook.unavailable.length
                ? outlook.unavailable.map((p) => p.label).join(", ")
                : "None identified"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Depth</p>
            <p className="font-semibold">{outlook.depthRating}</p>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Pitcher</th>
              <th className="pb-2 pr-3 font-medium">Total IP</th>
              <th className="pb-2 pr-3 font-medium">Pitches</th>
              <th className="pb-2 pr-3 font-medium">Games</th>
              <th className="pb-2 pr-3 font-medium">Bracket</th>
              <th className="pb-2 pr-3 font-medium">Remaining</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.playerKey} className="border-b border-muted">
                <td className="py-2 pr-3 font-medium">{summary.label}</td>
                <td className="py-2 pr-3">
                  {formatStat(summary.totalInnings, 1)}
                </td>
                <td className="py-2 pr-3">{summary.totalPitches || "—"}</td>
                <td className="py-2 pr-3">{summary.gameCount}</td>
                <td className="py-2 pr-3">{summary.bracketAppearances}</td>
                <td className="py-2 pr-3">
                  {summary.remainingInningsEstimate != null
                    ? formatStat(summary.remainingInningsEstimate, 1)
                    : "—"}
                </td>
                <td className="py-2">
                  <Badge
                    variant={availabilityVariant(summary.availability)}
                    className="text-xs"
                  >
                    {formatAvailability(summary.availability)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-sm">Pitcher Workloads</h3>
        {summaries.map((summary) => (
          <PitcherLedgerCard key={summary.playerKey} summary={summary} />
        ))}
      </div>
    </div>
  );
}
