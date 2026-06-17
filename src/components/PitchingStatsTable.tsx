"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
  | "strike_percentage";

interface PitchingStatsTableProps {
  stats: ExtractedPitchingStat[];
  editable?: boolean;
  showAll?: boolean;
  onUpdate?: (id: string, field: string, value: string) => void;
}

function hasPitchingData(stat: ExtractedPitchingStat): boolean {
  return [
    stat.innings_pitched,
    stat.era,
    stat.strikeouts,
    stat.walks,
    stat.hits_allowed,
    stat.strike_percentage,
    stat.pitches,
    stat.runs_allowed,
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

  const filtered = useMemo(
    () => (showAll ? stats : stats.filter(hasPitchingData)),
    [stats, showAll]
  );

  const showIp = filtered.some((s) => s.innings_pitched != null);
  const showEra = filtered.some((s) => s.era != null);
  const showK = filtered.some((s) => s.strikeouts != null);
  const showBb = filtered.some((s) => s.walks != null);
  const showH = filtered.some((s) => s.hits_allowed != null);
  const showStrikePct = filtered.some((s) => s.strike_percentage != null);
  const showWhip = filtered.some((s) => computeWhip(s) != null);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortField === "player_name") {
        const cmp = (a.player_name ?? "").localeCompare(b.player_name ?? "");
        return sortAsc ? cmp : -cmp;
      }
      const av = a[sortField] as number | null;
      const bv = b[sortField] as number | null;
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
    <th className="pb-2 pr-3 font-medium">
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <SortHeader field="player_name" label="Player" />
            {showIp && <SortHeader field="innings_pitched" label="IP" />}
            {showEra && <SortHeader field="era" label="ERA" />}
            {showK && <SortHeader field="strikeouts" label="K" />}
            {showBb && <SortHeader field="walks" label="BB" />}
            {showH && <SortHeader field="hits_allowed" label="H" />}
            {showWhip && <th className="pb-2 pr-3 font-medium">WHIP</th>}
            {showStrikePct && (
              <SortHeader field="strike_percentage" label="Strike %" />
            )}
            <th className="pb-2 font-medium w-24" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((stat) => (
            <tr key={stat.id} className="border-b border-muted">
              <td className="py-2 pr-3">
                {editable ? (
                  <Input
                    className="h-8"
                    defaultValue={stat.player_name ?? ""}
                    onBlur={(e) =>
                      onUpdate?.(stat.id, "player_name", e.target.value)
                    }
                  />
                ) : (
                  <>
                    {stat.player_name ?? "—"}
                    {stat.jersey_number && (
                      <span className="text-muted-foreground ml-1">
                        #{stat.jersey_number}
                      </span>
                    )}
                  </>
                )}
              </td>
              {showIp && (
                <td className="py-2 pr-3">
                  {formatStat(stat.innings_pitched, 1)}
                </td>
              )}
              {showEra && (
                <td className="py-2 pr-3">{formatStat(stat.era, 2)}</td>
              )}
              {showK && (
                <td className="py-2 pr-3">{stat.strikeouts ?? "—"}</td>
              )}
              {showBb && <td className="py-2 pr-3">{stat.walks ?? "—"}</td>}
              {showH && (
                <td className="py-2 pr-3">{stat.hits_allowed ?? "—"}</td>
              )}
              {showWhip && (
                <td className="py-2 pr-3">
                  {formatStat(computeWhip(stat), 2)}
                </td>
              )}
              {showStrikePct && (
                <td className="py-2 pr-3">
                  {formatPercent(stat.strike_percentage)}
                </td>
              )}
              <td className="py-2">
                <ConfidenceBadge confidence={stat.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
