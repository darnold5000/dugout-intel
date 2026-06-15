"use client";

import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { formatStat } from "@/lib/utils";
import type { ExtractedBattingStat } from "@/types";

interface BattingStatsTableProps {
  stats: ExtractedBattingStat[];
  editable?: boolean;
  onUpdate?: (id: string, field: string, value: string) => void;
}

export function BattingStatsTable({
  stats,
  editable = false,
  onUpdate,
}: BattingStatsTableProps) {
  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No batting stats extracted yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-3 font-medium">Player</th>
            <th className="pb-2 pr-3 font-medium">AVG</th>
            <th className="pb-2 pr-3 font-medium">OBP</th>
            <th className="pb-2 pr-3 font-medium">OPS</th>
            <th className="pb-2 pr-3 font-medium">H</th>
            <th className="pb-2 pr-3 font-medium">RBI</th>
            <th className="pb-2 font-medium">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
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
              <td className="py-2 pr-3">{formatStat(stat.avg)}</td>
              <td className="py-2 pr-3">{formatStat(stat.obp)}</td>
              <td className="py-2 pr-3">{formatStat(stat.ops)}</td>
              <td className="py-2 pr-3">{stat.hits ?? "—"}</td>
              <td className="py-2 pr-3">{stat.rbi ?? "—"}</td>
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
