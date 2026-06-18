"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { formatPercent, formatStat } from "@/lib/utils";
import type { ExtractedPitchingStat } from "@/types";
import { ArrowDown, ArrowUp } from "lucide-react";

type SortField =
  | "player_name"
  | "innings_pitched"
  | "era"
  | "strikeouts"
  | "walks"
  | "hits_allowed"
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

function hasPitchingData(stat: ExtractedPitchingStat): boolean {
  return [
    stat.innings_pitched,
    stat.era,
    stat.strikeouts,
    stat.walks,
    stat.hits_allowed,
    stat.strike_percentage,
    stat.total_pitches,
    stat.pitches,
    stat.first_pitch_strike_pct,
    stat.batters_faced,
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filtered = useMemo(
    () => (showAll ? stats : stats.filter(hasPitchingData)),
    [stats, showAll]
  );

  const showJersey = filtered.some((s) => s.jersey_number);
  const showIp = filtered.some((s) => s.innings_pitched != null);
  const showP = filtered.some((s) => pitchCount(s) != null);
  const showBf = filtered.some((s) => s.batters_faced != null);
  const showStrikes = filtered.some((s) => s.strikes != null);
  const showFps = filtered.some((s) => s.first_pitch_strike_pct != null);
  const showEra = filtered.some((s) => s.era != null);
  const showWhip = filtered.some((s) => computeWhip(s) != null);
  const showK = filtered.some((s) => s.strikeouts != null);
  const showBb = filtered.some((s) => s.walks != null);
  const showKbb = filtered.some((s) => s.k_bb_ratio != null);
  const showBbInn = filtered.some((s) => s.walks_per_inning != null);
  const showStrikePct = filtered.some((s) => s.strike_percentage != null);
  const showBaa = filtered.some((s) => s.baa != null);
  const showSm = filtered.some((s) => s.swing_miss_pct != null);
  const showPip = filtered.some((s) => s.pitches_per_inning != null);
  const showPbf = filtered.some((s) => s.pitches_per_batter_faced != null);
  const show123 = filtered.some((s) => s.one_two_three_innings != null);
  const showLoo = filtered.some((s) => s.leadoff_outs != null);
  const showBabip = filtered.some((s) => s.babip != null);
  const showFip = filtered.some((s) => s.fip != null);

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
      <div className="flex justify-end no-print">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide advanced" : "Show advanced"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <SortHeader field="player_name" label="Player" />
              {showJersey && <th className="pb-2 pr-3 font-medium">#</th>}
              {showIp && <SortHeader field="innings_pitched" label="IP" />}
              {showP && <SortHeader field="total_pitches" label="P" />}
              {showFps && (
                <SortHeader field="first_pitch_strike_pct" label="FPS%" />
              )}
              {showStrikePct && (
                <SortHeader field="strike_percentage" label="S%" />
              )}
              {showEra && <SortHeader field="era" label="ERA" />}
              {showWhip && <th className="pb-2 pr-3 font-medium">WHIP</th>}
              {showK && <SortHeader field="strikeouts" label="K" />}
              {showBb && <SortHeader field="walks" label="BB" />}
              {showKbb && <th className="pb-2 pr-3 font-medium">K/BB</th>}
              {showAdvanced && showBf && (
                <th className="pb-2 pr-3 font-medium">BF</th>
              )}
              {showAdvanced && showStrikes && (
                <th className="pb-2 pr-3 font-medium">S</th>
              )}
              {showAdvanced && showBbInn && (
                <th className="pb-2 pr-3 font-medium">BB/INN</th>
              )}
              {showAdvanced && showPip && (
                <th className="pb-2 pr-3 font-medium">P/IP</th>
              )}
              {showAdvanced && showPbf && (
                <th className="pb-2 pr-3 font-medium">P/BF</th>
              )}
              {showAdvanced && showBaa && (
                <th className="pb-2 pr-3 font-medium">BAA</th>
              )}
              {showAdvanced && showSm && (
                <th className="pb-2 pr-3 font-medium">SM%</th>
              )}
              {showAdvanced && show123 && (
                <th className="pb-2 pr-3 font-medium">123INN</th>
              )}
              {showAdvanced && showLoo && (
                <th className="pb-2 pr-3 font-medium">LOO</th>
              )}
              {showAdvanced && showBabip && (
                <th className="pb-2 pr-3 font-medium">BABIP</th>
              )}
              {showAdvanced && showFip && (
                <th className="pb-2 pr-3 font-medium">FIP</th>
              )}
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
                {showP && (
                  <td className="py-2 pr-3">{pitchCount(stat) ?? "—"}</td>
                )}
                {showFps && (
                  <td className="py-2 pr-3">
                    {formatPercent(stat.first_pitch_strike_pct)}
                  </td>
                )}
                {showStrikePct && (
                  <td className="py-2 pr-3">
                    {formatPercent(stat.strike_percentage)}
                  </td>
                )}
                {showEra && (
                  <td className="py-2 pr-3">{formatStat(stat.era, 2)}</td>
                )}
                {showWhip && (
                  <td className="py-2 pr-3">
                    {formatStat(computeWhip(stat), 2)}
                  </td>
                )}
                {showK && (
                  <td className="py-2 pr-3">{stat.strikeouts ?? "—"}</td>
                )}
                {showBb && <td className="py-2 pr-3">{stat.walks ?? "—"}</td>}
                {showKbb && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.k_bb_ratio, 2)}
                  </td>
                )}
                {showAdvanced && showBf && (
                  <td className="py-2 pr-3">{stat.batters_faced ?? "—"}</td>
                )}
                {showAdvanced && showStrikes && (
                  <td className="py-2 pr-3">{stat.strikes ?? "—"}</td>
                )}
                {showAdvanced && showBbInn && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.walks_per_inning, 2)}
                  </td>
                )}
                {showAdvanced && showPip && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.pitches_per_inning, 1)}
                  </td>
                )}
                {showAdvanced && showPbf && (
                  <td className="py-2 pr-3">
                    {formatStat(stat.pitches_per_batter_faced, 1)}
                  </td>
                )}
                {showAdvanced && showBaa && (
                  <td className="py-2 pr-3">{formatStat(stat.baa, 3)}</td>
                )}
                {showAdvanced && showSm && (
                  <td className="py-2 pr-3">
                    {formatPercent(stat.swing_miss_pct)}
                  </td>
                )}
                {showAdvanced && show123 && (
                  <td className="py-2 pr-3">
                    {stat.one_two_three_innings ?? "—"}
                  </td>
                )}
                {showAdvanced && showLoo && (
                  <td className="py-2 pr-3">{stat.leadoff_outs ?? "—"}</td>
                )}
                {showAdvanced && showBabip && (
                  <td className="py-2 pr-3">{formatStat(stat.babip, 3)}</td>
                )}
                {showAdvanced && showFip && (
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
    </div>
  );
}
