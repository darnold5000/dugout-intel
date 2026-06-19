import { parseBaseballInnings } from "@/lib/scouting/innings";
import { evidenceSourceCount } from "@/lib/scouting/evidence-timeline";
import { analyzePitchingStaff } from "@/lib/scouting/pitching-analysis";
import { buildTeamIntelligence } from "@/lib/scouting/team-intelligence";
import { formatDate } from "@/lib/utils";
import type { OpponentDetail } from "@/types";

export interface OpponentDashboardSummary {
  overallThreat: "Low" | "Medium" | "High";
  primaryPitcher: string | null;
  bestHitter: string | null;
  bestRunner: string | null;
  pitchingDepth: string;
  lastScouted: string | null;
  scoutNotesCount: number;
}

export function buildOpponentDashboardSummary(
  data: OpponentDetail
): OpponentDashboardSummary {
  const intelligence = buildTeamIntelligence(data);
  const pitching = analyzePitchingStaff(
    data.extracted_pitching_stats ?? [],
    data.opponent_notes ?? [],
    data.opponent_voice_notes ?? [],
    data.opponent_game_context ?? []
  );

  const topHitter =
    intelligence.offensiveLeaders.highest_ops ??
    intelligence.offensiveLeaders.highest_avg;
  const topPitcher = intelligence.pitchingLeaders.ace_pitcher;
  const topRunner = intelligence.offensiveLeaders.most_stolen_bases;

  const formatPlayer = (jersey: string | null, name: string) =>
    jersey ? `#${jersey} ${name}` : name;

  const tier1Count = intelligence.lineupThreatTiers.tier_1.length;
  const hasAce = pitching.some((p) =>
    p.roleLabels.includes("Likely Main Pitcher")
  );
  let overallThreat: "Low" | "Medium" | "High" = "Medium";
  if (tier1Count >= 2 && hasAce) overallThreat = "High";
  else if (tier1Count === 0 && pitching.length <= 1) overallThreat = "Low";

  const dates = [
    ...(data.screenshot_uploads ?? []).map((u) => u.created_at),
    ...(data.opponent_notes ?? []).map((n) => n.updated_at ?? n.created_at),
    ...(data.opponent_voice_notes ?? []).map((v) => v.created_at),
    ...(data.opponent_documents ?? []).map((d) => d.created_at),
  ];
  const lastScouted = dates.length
    ? formatDate(dates.sort().reverse()[0])
    : null;

  return {
    overallThreat,
    primaryPitcher: topPitcher
      ? formatPlayer(topPitcher.jersey_number, topPitcher.player_name)
      : pitching[0]?.label ?? null,
    bestHitter: topHitter
      ? formatPlayer(topHitter.jersey_number, topHitter.player_name)
      : null,
    bestRunner:
      topRunner &&
      (topRunner.stat_line.includes("SB") ||
        (data.extracted_batting_stats.find(
          (s) => s.player_name === topRunner.player_name
        )?.stolen_bases ?? 0) > 0)
        ? formatPlayer(topRunner.jersey_number, topRunner.player_name)
        : null,
    pitchingDepth:
      intelligence.teamIdentity?.pitching_depth ?? "Unknown",
    lastScouted,
    scoutNotesCount: evidenceSourceCount(data),
  };
}

export function getLatestEvidenceTimestamp(data: OpponentDetail): number | null {
  const timestamps = [
    ...(data.screenshot_uploads ?? []).map((u) =>
      new Date(u.created_at).getTime()
    ),
    ...(data.opponent_notes ?? []).map((n) =>
      new Date(n.updated_at ?? n.created_at).getTime()
    ),
    ...(data.opponent_voice_notes ?? []).map((v) =>
      new Date(v.created_at).getTime()
    ),
    ...(data.opponent_documents ?? []).map((d) =>
      new Date(d.created_at).getTime()
    ),
    ...(data.opponent_game_context ?? []).map((g) =>
      new Date(g.updated_at ?? g.created_at).getTime()
    ),
  ];
  return timestamps.length ? Math.max(...timestamps) : null;
}

export function reportNeedsRefresh(data: OpponentDetail): boolean {
  const latestReport = data.scouting_reports?.[0];
  if (!latestReport) return false;
  const latestEvidence = getLatestEvidenceTimestamp(data);
  if (!latestEvidence) return false;
  return latestEvidence > new Date(latestReport.created_at).getTime();
}

export function pitchersOverInnings(
  data: OpponentDetail,
  innings: number
): number {
  return (data.extracted_pitching_stats ?? []).filter((s) => {
    if (s.innings_pitched == null) return false;
    return parseBaseballInnings(s.innings_pitched) >= innings;
  }).length;
}
