"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExtractedPlayerTable } from "@/components/ExtractedPlayerTable";
import { BattingStatsTable } from "@/components/BattingStatsTable";
import { PitchingStatsTable } from "@/components/PitchingStatsTable";
import { GameResultsTable } from "@/components/GameResultsTable";
import { getAuthHeaders } from "@/lib/auth-headers";
import type { OpponentDetail } from "@/types";
import { Search } from "lucide-react";

interface ExtractedDataTabProps {
  data: OpponentDetail;
  onRefresh: () => Promise<void>;
}

export function ExtractedDataTab({ data, onRefresh }: ExtractedDataTabProps) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const handleUpdate = async (
    table: string,
    recordId: string,
    field: string,
    value: string
  ) => {
    setSaving(true);
    const authHeaders = await getAuthHeaders();
    await fetch("/api/extracted-data", {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        table,
        id: recordId,
        updates: { [field]: value || null },
      }),
    });
    setSaving(false);
    await onRefresh();
  };

  const q = search.toLowerCase();

  const players = useMemo(
    () =>
      data.extracted_players.filter(
        (p) =>
          !q ||
          p.name?.toLowerCase().includes(q) ||
          p.jersey_number?.includes(q) ||
          p.positions?.some((pos) => pos.toLowerCase().includes(q))
      ),
    [data.extracted_players, q]
  );

  const battingStats = useMemo(
    () =>
      data.extracted_batting_stats.filter(
        (s) =>
          !q ||
          s.player_name?.toLowerCase().includes(q) ||
          s.jersey_number?.includes(q)
      ),
    [data.extracted_batting_stats, q]
  );

  const pitchingStats = useMemo(
    () =>
      data.extracted_pitching_stats.filter(
        (s) =>
          !q ||
          s.player_name?.toLowerCase().includes(q) ||
          s.jersey_number?.includes(q)
      ),
    [data.extracted_pitching_stats, q]
  );

  const games = useMemo(
    () =>
      data.extracted_games.filter(
        (g) =>
          !q ||
          g.opponent_name?.toLowerCase().includes(q) ||
          g.result?.toLowerCase().includes(q)
      ),
    [data.extracted_games, q]
  );

  const hasData =
    data.extracted_players.length > 0 ||
    data.extracted_batting_stats.length > 0 ||
    data.extracted_pitching_stats.length > 0 ||
    data.extracted_games.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No extracted data yet. Upload screenshots and run AI extraction.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players, stats, games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Players: <strong className="text-foreground">{data.extracted_players.length}</strong></span>
          <span>Batting: <strong className="text-foreground">{data.extracted_batting_stats.length}</strong></span>
          <span>Pitching: <strong className="text-foreground">{data.extracted_pitching_stats.length}</strong></span>
          <span>Games: <strong className="text-foreground">{data.extracted_games.length}</strong></span>
        </div>
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground">Saving changes...</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Players</CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedPlayerTable
            players={players}
            editable
            onUpdate={(id, field, value) =>
              handleUpdate("extracted_players", id, field, value)
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batting Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <BattingStatsTable
            stats={battingStats}
            editable
            onUpdate={(id, field, value) =>
              handleUpdate("extracted_batting_stats", id, field, value)
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pitching Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <PitchingStatsTable
            stats={pitchingStats}
            editable
            onUpdate={(id, field, value) =>
              handleUpdate("extracted_pitching_stats", id, field, value)
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Games</CardTitle>
        </CardHeader>
        <CardContent>
          <GameResultsTable
            games={games}
            editable
            onUpdate={(id, field, value) =>
              handleUpdate("extracted_games", id, field, value)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
