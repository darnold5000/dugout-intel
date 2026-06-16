"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExtractedPlayerTable } from "@/components/ExtractedPlayerTable";
import { BattingStatsTable } from "@/components/BattingStatsTable";
import { PitchingStatsTable } from "@/components/PitchingStatsTable";
import { GameResultsTable } from "@/components/GameResultsTable";
import { RawExtractedTableViewer } from "@/components/RawExtractedTableViewer";
import { getAuthHeaders } from "@/lib/auth-headers";
import { formatDate } from "@/lib/utils";
import type { OpponentDetail } from "@/types";
import { ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";

interface ExtractedDataTabProps {
  data: OpponentDetail;
  onRefresh: () => Promise<void>;
}

export function ExtractedDataTab({ data, onRefresh }: ExtractedDataTabProps) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRawTables, setShowRawTables] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState("");

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

  const handleRebuildStats = async () => {
    setRebuilding(true);
    setRebuildMessage("");
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/opponents/${data.id}/rebuild-stats`,
        { method: "POST", headers: authHeaders }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rebuild failed");
      setRebuildMessage(
        `Consolidated ${body.counts.batting_stats} batting and ${body.counts.pitching_stats} pitching rows.`
      );
      await onRefresh();
    } catch (err) {
      setRebuildMessage(
        err instanceof Error ? err.message : "Rebuild failed"
      );
    } finally {
      setRebuilding(false);
    }
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

  const uploadsWithRawTables = useMemo(
    () =>
      data.screenshot_uploads.filter(
        (u) =>
          u.raw_extracted_table &&
          u.raw_extracted_table.headers.length > 0 &&
          u.raw_extracted_table.rows.length > 0
      ),
    [data.screenshot_uploads]
  );

  const hasData =
    data.extracted_players.length > 0 ||
    data.extracted_batting_stats.length > 0 ||
    data.extracted_pitching_stats.length > 0 ||
    data.extracted_games.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">
            No extracted data yet. Upload screenshots and run AI extraction.
          </p>
          {uploadsWithRawTables.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRebuildStats}
              disabled={rebuilding}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${rebuilding ? "animate-spin" : ""}`} />
              Rebuild consolidated stats
            </Button>
          )}
          {rebuildMessage && (
            <p className="text-xs text-muted-foreground">{rebuildMessage}</p>
          )}
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
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Players: <strong className="text-foreground">{data.extracted_players.length}</strong></span>
          <span>Batting: <strong className="text-foreground">{data.extracted_batting_stats.length}</strong></span>
          <span>Pitching: <strong className="text-foreground">{data.extracted_pitching_stats.length}</strong></span>
          <span>Games: <strong className="text-foreground">{data.extracted_games.length}</strong></span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebuildStats}
            disabled={rebuilding}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${rebuilding ? "animate-spin" : ""}`} />
            Rebuild stats
          </Button>
        </div>
      </div>

      {rebuildMessage && (
        <p className="text-xs text-muted-foreground">{rebuildMessage}</p>
      )}

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
          <p className="text-xs text-muted-foreground font-normal">
            Consolidated across all screenshots — one row per player.
          </p>
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
          <p className="text-xs text-muted-foreground font-normal">
            Consolidated across all screenshots — one row per player.
          </p>
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

      {uploadsWithRawTables.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setShowRawTables((v) => !v)}
            >
              {showRawTables ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              <CardTitle className="text-base">
                View Raw Screenshot Tables
              </CardTitle>
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                {uploadsWithRawTables.length} screenshot
                {uploadsWithRawTables.length === 1 ? "" : "s"}
              </span>
            </button>
          </CardHeader>
          {showRawTables && (
            <CardContent className="space-y-6">
              {uploadsWithRawTables.map((upload) => (
                <div key={upload.id} className="space-y-2">
                  <p className="text-sm font-medium">
                    {upload.screenshot_type?.replace(/_/g, " ") ?? "Screenshot"}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {formatDate(upload.created_at)}
                    </span>
                  </p>
                  <RawExtractedTableViewer
                    table={upload.raw_extracted_table}
                    warnings={upload.extraction_warnings}
                  />
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
