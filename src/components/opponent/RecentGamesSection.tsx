"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { RecentGameRow } from "@/lib/scouting/game-results";

interface RecentGamesSectionProps {
  games: RecentGameRow[];
}

export function RecentGamesSection({ games }: RecentGamesSectionProps) {
  if (games.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          No game results yet. Upload a schedule or results screenshot in Scout
          Notes, then run Extract Stats.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {games.map((game) => (
        <div
          key={game.id}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium truncate">
              {game.gameDate ? formatDate(game.gameDate) : "Unknown date"}
              {game.opponentName ? ` vs ${game.opponentName}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {game.result && (
              <Badge
                variant={
                  game.result.toLowerCase().startsWith("w")
                    ? "default"
                    : game.result.toLowerCase().startsWith("l")
                      ? "secondary"
                      : "outline"
                }
                className="text-xs"
              >
                {game.result}
              </Badge>
            )}
            <span className="font-semibold tabular-nums">{game.scoreLine}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
