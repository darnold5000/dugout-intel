"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExtractedPlayerTable } from "@/components/ExtractedPlayerTable";
import { BattingStatsTable } from "@/components/BattingStatsTable";
import { PitchingStatsTable } from "@/components/PitchingStatsTable";
import { GameResultsTable } from "@/components/GameResultsTable";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, FileText } from "lucide-react";
import type { OpponentDetail } from "@/types";

export default function ExtractedDataPage() {
  const { id } = useParams<{ id: string }>();
  const [opponent, setOpponent] = useState<OpponentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchOpponent = useCallback(async () => {
    const res = await fetch(`/api/opponents/${id}`);
    if (res.ok) {
      setOpponent(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchOpponent();
  }, [fetchOpponent]);

  const handleUpdate = async (
    table: string,
    recordId: string,
    field: string,
    value: string
  ) => {
    setSaving(true);
    await fetch("/api/extracted-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table,
        id: recordId,
        updates: { [field]: value || null },
      }),
    });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  const hasData =
    (opponent?.extracted_players?.length ?? 0) > 0 ||
    (opponent?.extracted_batting_stats?.length ?? 0) > 0 ||
    (opponent?.extracted_pitching_stats?.length ?? 0) > 0 ||
    (opponent?.extracted_games?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/opponents/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Extracted Data</h1>
            <p className="text-muted-foreground">
              Review and edit data for {opponent?.name}
            </p>
          </div>
          {hasData && (
            <Button asChild>
              <Link href={`/opponents/${id}/report`}>
                <FileText className="h-4 w-4 mr-1" />
                Generate scouting report
              </Link>
            </Button>
          )}
        </div>

        {saving && (
          <p className="text-xs text-muted-foreground mb-4">Saving...</p>
        )}

        {!hasData ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No extracted data yet. Upload screenshots and run AI extraction.
              </p>
              <Button asChild>
                <Link href={`/opponents/${id}/upload`}>Upload screenshots</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Players</CardTitle>
              </CardHeader>
              <CardContent>
                <ExtractedPlayerTable
                  players={opponent?.extracted_players ?? []}
                  editable
                  onUpdate={(recordId, field, value) =>
                    handleUpdate("extracted_players", recordId, field, value)
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
                  stats={opponent?.extracted_batting_stats ?? []}
                  editable
                  onUpdate={(recordId, field, value) =>
                    handleUpdate(
                      "extracted_batting_stats",
                      recordId,
                      field,
                      value
                    )
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
                  stats={opponent?.extracted_pitching_stats ?? []}
                  editable
                  onUpdate={(recordId, field, value) =>
                    handleUpdate(
                      "extracted_pitching_stats",
                      recordId,
                      field,
                      value
                    )
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Game Results</CardTitle>
              </CardHeader>
              <CardContent>
                <GameResultsTable games={opponent?.extracted_games ?? []} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
