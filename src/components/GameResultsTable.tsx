import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { formatDate } from "@/lib/utils";
import type { ExtractedGame } from "@/types";

interface GameResultsTableProps {
  games: ExtractedGame[];
}

export function GameResultsTable({ games }: GameResultsTableProps) {
  if (games.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No game results extracted yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 font-medium">Date</th>
            <th className="pb-2 pr-4 font-medium">Opponent</th>
            <th className="pb-2 pr-4 font-medium">Result</th>
            <th className="pb-2 pr-4 font-medium">Score</th>
            <th className="pb-2 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id} className="border-b border-muted">
              <td className="py-2 pr-4">{formatDate(game.game_date)}</td>
              <td className="py-2 pr-4">{game.opponent_name ?? "—"}</td>
              <td className="py-2 pr-4">{game.result ?? "—"}</td>
              <td className="py-2 pr-4">
                {game.runs_for != null && game.runs_against != null
                  ? `${game.runs_for}-${game.runs_against}`
                  : "—"}
              </td>
              <td className="py-2">
                <ConfidenceBadge confidence={game.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
