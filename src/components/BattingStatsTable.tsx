"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { StatsLegend } from "@/components/StatsLegend";
import { formatStat } from "@/lib/utils";
import { BATTING_STAT_TERMS, pickLegendTerms } from "@/lib/stat-legend";
import type { ExtractedBattingStat } from "@/types";
import { ArrowDown, ArrowUp } from "lucide-react";

type SortField =
  | "player_name"
  | "avg"
  | "obp"
  | "ops"
  | "hits"
  | "rbi"
  | "runs"
  | "walks"
  | "strikeouts"
  | "stolen_bases";

interface BattingStatsTableProps {
  stats: ExtractedBattingStat[];
  editable?: boolean;
  onUpdate?: (id: string, field: string, value: string) => void;
}

const COLUMNS: Array<{
  key: SortField;
  label: string;
  format?: (s: ExtractedBattingStat) => string;
}> = [
  { key: "player_name", label: "Player" },
  { key: "avg", label: "AVG", format: (s) => formatStat(s.avg) },
  { key: "obp", label: "OBP", format: (s) => formatStat(s.obp) },
  { key: "ops", label: "OPS", format: (s) => formatStat(s.ops) },
  { key: "hits", label: "H", format: (s) => String(s.hits ?? "—") },
  { key: "rbi", label: "RBI", format: (s) => String(s.rbi ?? "—") },
  { key: "runs", label: "R", format: (s) => String(s.runs ?? "—") },
  { key: "walks", label: "BB", format: (s) => String(s.walks ?? "—") },
  { key: "strikeouts", label: "SO", format: (s) => String(s.strikeouts ?? "—") },
  { key: "stolen_bases", label: "SB", format: (s) => String(s.stolen_bases ?? "—") },
];

function defaultSort(a: ExtractedBattingStat, b: ExtractedBattingStat): number {
  return (
    (b.ops ?? b.obp ?? b.avg ?? -1) - (a.ops ?? a.obp ?? a.avg ?? -1)
  );
}

export function BattingStatsTable({
  stats,
  editable = false,
  onUpdate,
}: BattingStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>("ops");
  const [sortAsc, setSortAsc] = useState(false);

  const visibleColumns = useMemo(() => {
    return COLUMNS.filter((col) => {
      if (col.key === "player_name") return true;
      return stats.some((s) => s[col.key as keyof ExtractedBattingStat] != null);
    });
  }, [stats]);

  const legendTerms = useMemo(
    () =>
      pickLegendTerms(
        BATTING_STAT_TERMS,
        visibleColumns
          .filter((col) => col.key !== "player_name")
          .map((col) => col.label)
      ),
    [visibleColumns]
  );

  const sorted = useMemo(() => {
    const copy = [...stats];
    copy.sort((a, b) => {
      if (sortField === "player_name") {
        const cmp = (a.player_name ?? "").localeCompare(b.player_name ?? "");
        return sortAsc ? cmp : -cmp;
      }
      const av = a[sortField] as number | null;
      const bv = b[sortField] as number | null;
      const diff = (av ?? -1) - (bv ?? -1);
      return sortAsc ? diff : -diff;
    });
    if (sortField === "ops" && !sortAsc) {
      copy.sort(defaultSort);
    }
    return copy;
  }, [stats, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "player_name");
    }
  };

  if (stats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No batting stats yet. Upload batting stat screenshots to populate this section.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {visibleColumns.map((col) => (
              <th key={col.key} className="pb-2 pr-3 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground text-muted-foreground"
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {sortField === col.key &&
                    (sortAsc ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                </button>
              </th>
            ))}
            <th className="pb-2 font-medium w-24" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((stat) => (
            <tr key={stat.id} className="border-b border-muted">
              {visibleColumns.map((col) => (
                <td key={col.key} className="py-2 pr-3">
                  {col.key === "player_name" ? (
                    editable ? (
                      <Input
                        className="h-8"
                        defaultValue={stat.player_name ?? ""}
                        onBlur={(e) =>
                          onUpdate?.(stat.id, "player_name", e.target.value)
                        }
                      />
                    ) : (
                      <span>
                        {stat.player_name ?? "—"}
                        {stat.jersey_number && (
                          <span className="text-muted-foreground ml-1">
                            #{stat.jersey_number}
                          </span>
                        )}
                      </span>
                    )
                  ) : (
                    col.format?.(stat) ?? "—"
                  )}
                </td>
              ))}
              <td className="py-2">
                <ConfidenceBadge confidence={stat.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <StatsLegend terms={legendTerms} />
    </div>
  );
}
