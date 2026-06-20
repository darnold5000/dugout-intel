"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { deriveBattersFaced, enrichPitchingStatForDisplay } from "@/lib/scouting/pitching-derived";
import { StatsLegend } from "@/components/StatsLegend";
import { formatPercent, formatStat, normalizePctDecimal } from "@/lib/utils";
import { PITCHING_STAT_TERMS, pickLegendTerms } from "@/lib/stat-legend";
import type { ExtractedPitchingStat } from "@/types";
import { ArrowDown, ArrowUp } from "lucide-react";

type SortField =
  | "player_name"
  | "innings_pitched"
  | "hits_allowed"
  | "runs_allowed"
  | "earned_runs"
  | "era"
  | "strikeouts"
  | "walks"
  | "strike_percentage"
  | "total_pitches"
  | "first_pitch_strike_pct";

interface PitchingStatsTableProps {
  stats: ExtractedPitchingStat[];
  editable?: boolean;
  showAll?: boolean;
  onUpdate?: (id: string, field: string, value: string) => void;
}

function pitchCount(stat: ExtractedPitchingStat): number | null {
  return stat.total_pitches ?? stat.pitches;
}

function pitchStrikesLine(stat: ExtractedPitchingStat): string | null {
  const pitches = pitchCount(stat);
  if (pitches == null || stat.strikes == null) return null;
  return `${pitches}-${stat.strikes}`;
}

function derivedStrikePct(stat: ExtractedPitchingStat): number | null {
  const pitches = pitchCount(stat);
  if (stat.strikes != null && pitches != null && pitches > 0) {
    return (stat.strikes / pitches) * 100;
  }
  const pct = normalizePctDecimal(stat.strike_percentage);
  if (pct == null) return null;
  return pct * 100;
}

function derivedBalls(stat: ExtractedPitchingStat): number | null {
  const pitches = pitchCount(stat);
  if (pitches == null || stat.strikes == null) return null;
  return pitches - stat.strikes;
}

/** Legacy rows stored ER in runs_allowed before earned_runs existed. */
function displayEarnedRuns(stat: ExtractedPitchingStat): number | null {
  return stat.earned_runs ?? stat.runs_allowed;
}

function hasPitchingData(stat: ExtractedPitchingStat): boolean {
  return [
    stat.innings_pitched,
    stat.era,
    stat.strikeouts,
    stat.walks,
    stat.hits_allowed,
    stat.runs_allowed,
    stat.earned_runs,
    stat.strike_percentage,
    stat.total_pitches,
    stat.pitches,
    stat.strikes,
    stat.batters_faced,
    stat.first_pitch_strike_pct,
    stat.k_bb_ratio,
  ].some((v) => v != null);
}

function computeWhip(stat: ExtractedPitchingStat): number | null {
  if (stat.innings_pitched == null || stat.innings_pitched <= 0) return null;
  const bb = stat.walks ?? 0;
  const h = stat.hits_allowed ?? 0;
  if (stat.walks == null && stat.hits_allowed == null) return null;
  return (bb + h) / stat.innings_pitched;
}

export function PitchingStatsTable({
  stats,
  editable = false,
  showAll = false,
  onUpdate,
}: PitchingStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>("innings_pitched");
  const [sortAsc, setSortAsc] = useState(false);

  const enrichedStats = useMemo(
    () => stats.map(enrichPitchingStatForDisplay),
    [stats]
  );

  const filtered = useMemo(
    () => (showAll ? enrichedStats : enrichedStats.filter(hasPitchingData)),
    [enrichedStats, showAll]
  );

  const showJersey = filtered.some((s) => s.jersey_number);
  const showIp = filtered.some((s) => s.innings_pitched != null);
  const showH = filtered.some((s) => s.hits_allowed != null);
  const showR = filtered.some((s) => s.runs_allowed != null);
  const showEr = filtered.some((s) => displayEarnedRuns(s) != null);
  const showPitchStrikes = filtered.some((s) => pitchStrikesLine(s) != null);
  const showP =
    filtered.some((s) => pitchCount(s) != null) && !showPitchStrikes;
  const showBf = filtered.some((s) => deriveBattersFaced(s) != null);
  const showBalls = filtered.some((s) => derivedBalls(s) != null);
  const showFps = filtered.some((s) => s.first_pitch_strike_pct != null);
  const showEra = filtered.some((s) => s.era != null);
  const showWhip = filtered.some((s) => computeWhip(s) != null);
  const showK = filtered.some((s) => s.strikeouts != null);
  const showBb = filtered.some((s) => s.walks != null);
  const showKbb = filtered.some((s) => s.k_bb_ratio != null);
  const showBbInn = filtered.some((s) => s.walks_per_inning != null);
  const showStrikePct = filtered.some((s) => derivedStrikePct(s) != null);
  const showBaa = filtered.some((s) => s.baa != null);
  const showSm = filtered.some((s) => s.swing_miss_pct != null);
  const showPip = filtered.some((s) => s.pitches_per_inning != null);
  const showPbf = filtered.some((s) => s.pitches_per_batter_faced != null);
  const show123 = filtered.some((s) => s.one_two_three_innings != null);
  const showLoo = filtered.some((s) => s.leadoff_outs != null);
  const showBabip = filtered.some((s) => s.babip != null);
  const showFip = filtered.some((s) => s.fip != null);

  const legendTerms = useMemo(() => {
    const abbrs: string[] = [];
    if (showIp) abbrs.push("IP");
    if (showH) abbrs.push("H");
    if (showR) abbrs.push("R");
    if (showEr) abbrs.push("ER");
    if (showBb) abbrs.push("BB");
    if (showK) abbrs.push("K");
    if (showEra) abbrs.push("ERA");
    if (showWhip) abbrs.push("WHIP");
    if (showP) abbrs.push("P");
    if (showPitchStrikes) abbrs.push("P-S");
    if (showBf) abbrs.push("BF");
    if (showBalls) abbrs.push("B");
    if (showStrikePct) abbrs.push("S%");
    if (showFps) abbrs.push("FPS%");
    if (showKbb) abbrs.push("K/BB");
    if (showBbInn) abbrs.push("BB/INN");
    if (showPip) abbrs.push("P/IP");
    if (showPbf) abbrs.push("P/BF");
    if (showBaa) abbrs.push("BAA");
    if (showSm) abbrs.push("SM%");
    if (show123) abbrs.push("123INN");
    if (showLoo) abbrs.push("LOO");
    if (showBabip) abbrs.push("BABIP");
    if (showFip) abbrs.push("FIP");
    return pickLegendTerms(PITCHING_STAT_TERMS, abbrs);
  }, [
    showIp,
    showH,
    showR,
    showEr,
    showBb,
    showK,
    showEra,
    showWhip,
    showP,
    showPitchStrikes,
    showBf,
    showBalls,
    showStrikePct,
    showFps,
    showKbb,
    showBbInn,
    showPip,
    showPbf,
    showBaa,
    showSm,
    show123,
    showLoo,
    showBabip,
    showFip,
  ]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortField === "player_name") {
        const cmp = (a.player_name ?? "").localeCompare(b.player_name ?? "");
        return sortAsc ? cmp : -cmp;
      }
      let av: number | null;
      let bv: number | null;
      if (sortField === "total_pitches") {
        av = pitchCount(a);
        bv = pitchCount(b);
      } else if (sortField === "earned_runs") {
        av = displayEarnedRuns(a);
        bv = displayEarnedRuns(b);
      } else {
        av = a[sortField] as number | null;
        bv = b[sortField] as number | null;
      }
      if (sortField === "era") {
        const diff = (av ?? 999) - (bv ?? 999);
        return sortAsc ? -diff : diff;
      }
      const diff = (av ?? -1) - (bv ?? -1);
      return sortAsc ? diff : -diff;
    });
    return copy;
  }, [filtered, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(field === "player_name" || field === "era");
    }
  };

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <th className="pb-2 pr-3 font-medium whitespace-nowrap">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground text-muted-foreground"
        onClick={() => toggleSort(field)}
      >
        {label}
        {sortField === field &&
          (sortAsc ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No pitching stats yet. Upload a pitching stats screenshot that includes IP or ERA columns.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <SortHeader field="player_name" label="Player" />
              {showJersey && <th className="pb-2 pr-3 font-medium">#</th>}
              {showIp && <SortHeader field="innings_pitched" label="IP" />}
              {showH && <SortHeader field="hits_allowed" label="H" />}
              {showR && <SortHeader field="runs_allowed" label="R" />}
              {showEr && <SortHeader field="earned_runs" label="ER" />}
              {showBb && <SortHeader field="walks" label="BB" />}
              {showK && <SortHeader field="strikeouts" label="K" />}
              {showEra && <SortHeader field="era" label="ERA" />}
              {showWhip && <th className="pb-2 pr-3 font-medium">WHIP</th>}
              {showPitchStrikes && (
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">
                  P-S
                </th>
              )}
              {showP && <SortHeader field="total_pitches" label="P" />}
              {showBf && (
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">BF</th>
              )}
              {showBalls && (
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">B</th>
              )}
              {showStrikePct && (
                <SortHeader field="strike_percentage" label="S%" />
              )}
              {showFps && (
                <SortHeader field="first_pitch_strike_pct" label="FPS%" />
              )}
              {showKbb && <th className="pb-2 pr-3 font-medium">K/BB</th>}
              {showBbInn && (
                <th className="pb-2 pr-3 font-medium">BB/INN</th>
              )}
              {showPip && <th className="pb-2 pr-3 font-medium">P/IP</th>}
              {showPbf && <th className="pb-2 pr-3 font-medium">P/BF</th>}
              {showBaa && <th className="pb-2 pr-3 font-medium">BAA</th>}
              {showSm && <th className="pb-2 pr-3 font-medium">SM%</th>}
              {show123 && <th className="pb-2 pr-3 font-medium">123INN</th>}
              {showLoo && <th className="pb-2 pr-3 font-medium">LOO</th>}
              {showBabip && <th className="pb-2 pr-3 font-medium">BABIP</th>}
              {showFip && <th className="pb-2 pr-3 font-medium">FIP</th>}
              <th className="pb-2 font-medium w-24" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((stat) => (
              <tr key={stat.id} className="border-b border-muted">
                <td className="py-2 pr-3 whitespace-nowrap">
                  {editable ? (
                    <Input
                      className="h-8"
                      defaultValue={stat.player_name ?? ""}
                      onBlur={(e) =>
                        onUpdate?.(stat.id, "player_name", e.target.value)
                      }
                    />
                  ) : (
                    stat.player_name ?? "—"
                  )}
                </td>
                {showJersey && (
                  <td className="py-2 pr-3 text-muted-foreground">
                    {stat.jersey_number ? `#${stat.jersey_number}` : "—"}
                  </td>
                )}
                {showIp && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.innings_pitched, 1)}
                  </td>
                )}
                {showH && (
                  <td className="py-2 pr-3">{stat.hits_allowed ?? "—"}</td>
                )}
                {showR && (
                  <td className="py-2 pr-3">{stat.runs_allowed ?? "—"}</td>
                )}
                {showEr && (
                  <td className="py-2 pr-3">
                    {displayEarnedRuns(stat) ?? "—"}
                  </td>
                )}
                {showBb && <td className="py-2 pr-3">{stat.walks ?? "—"}</td>}
                {showK && (
                  <td className="py-2 pr-3">{stat.strikeouts ?? "—"}</td>
                )}
                {showEra && (
                  <td className="py-2 pr-3">{formatStat(stat.era, 2)}</td>
                )}
                {showWhip && (
                  <td className="py-2 pr-3">
                    {formatStat(computeWhip(stat), 2)}
                  </td>
                )}
                {showPitchStrikes && (
                  <td className="py-2 pr-3">{pitchStrikesLine(stat) ?? "—"}</td>
                )}
                {showP && (
                  <td className="py-2 pr-3">{pitchCount(stat) ?? "—"}</td>
                )}
                {showBf && (
                  <td className="py-2 pr-3">{deriveBattersFaced(stat) ?? "—"}</td>
                )}
                {showBalls && (
                  <td className="py-2 pr-3">{derivedBalls(stat) ?? "—"}</td>
                )}
                {showStrikePct && (
                  <td className="py-2 pr-3">
                    {formatPercent(derivedStrikePct(stat))}
                  </td>
                )}
                {showFps && (
                  <td className="py-2 pr-3">
                    {formatPercent(stat.first_pitch_strike_pct)}
                  </td>
                )}
                {showKbb && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.k_bb_ratio, 2)}
                  </td>
                )}
                {showBbInn && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.walks_per_inning, 2)}
                  </td>
                )}
                {showPip && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.pitches_per_inning, 1)}
                  </td>
                )}
                {showPbf && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.pitches_per_batter_faced, 1)}
                  </td>
                )}
                {showBaa && (
                  <td className="py-2 pr-3">{formatStat(stat.baa, 3)}</td>
                )}
                {showSm && (
                  <td className="py-2 pr-3">
                    {formatPercent(stat.swing_miss_pct)}
                  </td>
                )}
                {show123 && (
                  <td className="py-2 pr-3">
                    {stat.one_two_three_innings ?? "—"}
                  </td>
                )}
                {showLoo && (
                  <td className="py-2 pr-3">{stat.leadoff_outs ?? "—"}</td>
                )}
                {showBabip && (
                  <td className="py-2 pr-3">{formatStat(stat.babip, 3)}</td>
                )}
                {showFip && (
                  <td className="py-2 pr-3">{formatStat(stat.fip, 2)}</td>
                )}
                <td className="py-2">
                  <ConfidenceBadge confidence={stat.confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StatsLegend terms={legendTerms} className="mt-3" />
    </div>
  );
}
