"use client";

import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import type { ExtractedPlayer } from "@/types";

interface ExtractedPlayerTableProps {
  players: ExtractedPlayer[];
  editable?: boolean;
  onUpdate?: (id: string, field: string, value: string) => void;
}

export function ExtractedPlayerTable({
  players,
  editable = false,
  onUpdate,
}: ExtractedPlayerTableProps) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No players extracted yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 font-medium">#</th>
            <th className="pb-2 pr-4 font-medium">Name</th>
            <th className="pb-2 pr-4 font-medium">Positions</th>
            <th className="pb-2 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-b border-muted">
              <td className="py-2 pr-4">
                {editable ? (
                  <Input
                    className="h-8 w-16"
                    defaultValue={player.jersey_number ?? ""}
                    onBlur={(e) =>
                      onUpdate?.(player.id, "jersey_number", e.target.value)
                    }
                  />
                ) : (
                  player.jersey_number ?? "—"
                )}
              </td>
              <td className="py-2 pr-4">
                {editable ? (
                  <Input
                    className="h-8"
                    defaultValue={player.name ?? ""}
                    onBlur={(e) => onUpdate?.(player.id, "name", e.target.value)}
                  />
                ) : (
                  player.name ?? "—"
                )}
              </td>
              <td className="py-2 pr-4">
                {player.positions?.join(", ") ?? "—"}
              </td>
              <td className="py-2">
                <ConfidenceBadge confidence={player.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
