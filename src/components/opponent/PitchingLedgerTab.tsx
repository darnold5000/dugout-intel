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
import { RebuildStatsButton } from "@/components/opponent/RebuildStatsButton";
import { formatPitchingRulesBlurb } from "@/lib/scouting/pitching-rules";
import { formatDate, formatPitchStrikes, formatStat } from "@/lib/utils";
import type { OpponentDetail, PitcherLedgerSummary } from "@/types";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { StatsLegend } from "@/components/StatsLegend";
import { pickLegendTerms, PITCHING_STAT_TERMS } from "@/lib/stat-legend";

interface PitchingLedgerTabProps {
  opponentId: string;
  data: OpponentDetail;
  onSwitchTab?: (tab: string) => void;
  onRefresh?: () => Promise<void>;
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
  const pitchStrikesTotal =
    summary.totalStrikes != null
      ? formatPitchStrikes(summary.totalPitches, summary.totalStrikes)
      : null;

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
            <p className="text-xs text-muted-foreground">
              {pitchStrikesTotal ? "P-S" : "Pitches"}
            </p>
            <p className="font-semibold">
              {pitchStrikesTotal ?? (summary.totalPitches || "—")}
            </p>
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
                  {formatPitchStrikes(app.pitch_count, app.strikes) ? (
                    <span>
                      {formatPitchStrikes(app.pitch_count, app.strikes)} P-S
                    </span>
                  ) : (
                    app.pitch_count != null && (
                      <span>{app.pitch_count} pitches</span>
                    )
                  )}
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
  opponentId,
  data,
  onSwitchTab,
  onRefresh,
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
  const showPitchStrikes = summaries.some((s) => s.totalStrikes != null);
  const ledgerLegend = useMemo(
    () =>
      showPitchStrikes
        ? pickLegendTerms(PITCHING_STAT_TERMS, ["P-S"])
        : [],
    [showPitchStrikes]
  );

  if (entries.length === 0) {
    const pendingExtract = (data.screenshot_uploads ?? []).some(
      (u) => u.extraction_status === "pending"
    );
    const missingDates = (data.screenshot_uploads ?? []).some(
      (u) =>
        u.extraction_status === "complete" &&
        !u.game_date &&
        (u.screenshot_type === "box_score" ||
          u.screenshot_type === "pitching_stats")
    );

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              No pitching ledger entries yet. Each pitcher appearance needs a{" "}
              <strong>game date on the screenshot</strong> (not just in a
              separate context note) plus extracted pitching stats.
            </p>
            <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-1 list-disc pl-5">
              <li>
                Expand Add Context before upload — date + opponent tag the box
                score automatically
              </li>
              <li>Or open a screenshot → Save game tags after upload</li>
              <li>Run Extract Stats if the screenshot is still pending</li>
              <li>
                Or use pitcher # + innings in Add Context (no screenshot needed)
              </li>
            </ul>
            {pendingExtract && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                You have screenshots waiting — run Extract Stats in Scout Notes.
              </p>
            )}
            {missingDates && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                A box score was extracted but is missing a game date — tag it in
                Screenshot Details.
              </p>
            )}
            {onSwitchTab && (
              <Button variant="outline" onClick={() => onSwitchTab("scout-notes")}>
                Go to Scout Notes
              </Button>
            )}
            {onRefresh && (
              <RebuildStatsButton
                opponentId={opponentId}
                onComplete={onRefresh}
                label="Refresh Ledger"
              />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Ledger rebuilds automatically after extract, game tags, and pitcher
          workload saves. Refresh if data looks stale.
        </p>
        {onRefresh && (
          <RebuildStatsButton
            opponentId={opponentId}
            onComplete={onRefresh}
            label="Refresh Ledger"
            className="shrink-0"
          />
        )}
      </div>
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
              <th className="pb-2 pr-3 font-medium">
                {showPitchStrikes ? "P-S" : "Pitches"}
              </th>
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
                <td className="py-2 pr-3">
                  {summary.totalStrikes != null
                    ? formatPitchStrikes(
                        summary.totalPitches,
                        summary.totalStrikes
                      )
                    : summary.totalPitches || "—"}
                </td>
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
      {ledgerLegend.length > 0 && <StatsLegend terms={ledgerLegend} />}
    </div>
  );
}
