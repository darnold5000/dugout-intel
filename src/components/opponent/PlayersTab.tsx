"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NeedsReviewIndicator } from "@/components/NeedsReviewIndicator";
import { RebuildStatsButton } from "@/components/opponent/RebuildStatsButton";
import { BattingStatsTable } from "@/components/BattingStatsTable";
import { PitchingStatsTable } from "@/components/PitchingStatsTable";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  buildPlayerProfiles,
  formatPlayerLabel,
  battingSummary,
  pitchingSummary,
  type PlayerProfile,
} from "@/lib/scouting/player-profiles";
import type { OpponentDetail } from "@/types";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

interface PlayersTabProps {
  data: OpponentDetail;
  onRefresh: () => Promise<void>;
}

function PlayerCard({
  profile,
  uploads,
  onUpdateBatting,
  onUpdatePitching,
}: {
  profile: PlayerProfile;
  uploads: OpponentDetail["screenshot_uploads"];
  onUpdateBatting: (id: string, field: string, value: string) => void;
  onUpdatePitching: (id: string, field: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const sourceLabels = profile.sourceUploadIds
    .map((id) => {
      const upload = uploads.find((u) => u.id === id);
      if (!upload) return null;
      return upload.screenshot_type?.replace(/_/g, " ") ?? "Screenshot";
    })
    .filter(Boolean);

  return (
    <Card>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">{formatPlayerLabel(profile)}</CardTitle>
                <NeedsReviewIndicator
                  confidence={profile.confidence}
                  needsReview={profile.needsReview}
                />
              </div>
              {profile.batting && (
                <p className="text-xs text-muted-foreground mt-1">
                  Batting: {battingSummary(profile)}
                </p>
              )}
              {profile.pitching && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pitching: {pitchingSummary(profile)}
                </p>
              )}
              {profile.roster?.positions?.length ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile.roster.positions.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-4 border-t">
          {profile.reviewReasons.length > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              {profile.reviewReasons.map((reason, i) => (
                <p key={i}>• {reason}</p>
              ))}
            </div>
          )}

          {profile.batting && (
            <div>
              <p className="text-sm font-medium mb-2">Batting</p>
              <BattingStatsTable
                stats={[profile.batting]}
                editable
                onUpdate={onUpdateBatting}
              />
            </div>
          )}

          {profile.pitching && (
            <div>
              <p className="text-sm font-medium mb-2">Pitching</p>
              <PitchingStatsTable
                stats={[profile.pitching]}
                editable
                onUpdate={onUpdatePitching}
              />
            </div>
          )}

          {sourceLabels.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Source screenshots: {sourceLabels.join(", ")}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function PlayersTab({ data, onRefresh }: PlayersTabProps) {
  const [search, setSearch] = useState("");
  const [showAllPitchers, setShowAllPitchers] = useState(false);

  const profiles = useMemo(() => buildPlayerProfiles(data), [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.jerseyNumber?.includes(q)
    );
  }, [profiles, search]);

  const handleUpdate = async (
    table: string,
    recordId: string,
    field: string,
    value: string
  ) => {
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
    await onRefresh();
  };

  const pitchersWithData = data.extracted_pitching_stats.filter(
    (s) =>
      s.innings_pitched != null ||
      s.era != null ||
      s.strikeouts != null
  );

  if (profiles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">
            No players yet. Upload screenshots and run extraction.
          </p>
          <RebuildStatsButton opponentId={data.id} onComplete={onRefresh} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} player{filtered.length === 1 ? "" : "s"}
        </p>
        <RebuildStatsButton opponentId={data.id} onComplete={onRefresh} />
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map((profile) => (
          <PlayerCard
            key={profile.key}
            profile={profile}
            uploads={data.screenshot_uploads}
            onUpdateBatting={(id, field, value) =>
              handleUpdate("extracted_batting_stats", id, field, value)
            }
            onUpdatePitching={(id, field, value) =>
              handleUpdate("extracted_pitching_stats", id, field, value)
            }
          />
        ))}
      </div>

      <div className="hidden md:block space-y-3">
        {filtered.map((profile) => (
          <PlayerCard
            key={profile.key}
            profile={profile}
            uploads={data.screenshot_uploads}
            onUpdateBatting={(id, field, value) =>
              handleUpdate("extracted_batting_stats", id, field, value)
            }
            onUpdatePitching={(id, field, value) =>
              handleUpdate("extracted_pitching_stats", id, field, value)
            }
          />
        ))}
      </div>

      {pitchersWithData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pitching Staff</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllPitchers((v) => !v)}
            >
              {showAllPitchers ? "Pitchers only" : "Show all players"}
            </Button>
          </CardHeader>
          <CardContent>
            <PitchingStatsTable
              stats={data.extracted_pitching_stats}
              showAll={showAllPitchers}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
