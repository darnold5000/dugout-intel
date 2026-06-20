import { parseBaseballInnings } from "@/lib/scouting/innings";
import { evidenceSourceCount } from "@/lib/scouting/evidence-timeline";
import {
  analyzePitchingStaffFromDetail,
  type PitcherAnalysis,
} from "@/lib/scouting/pitching-analysis";
import {
  resolveBestHitterPick,
  resolveBestRunnerPick,
} from "@/lib/scouting/offensive-leaders";
import { buildTeamIntelligence } from "@/lib/scouting/team-intelligence";
import { formatDate } from "@/lib/utils";
import type { OpponentDetail, TeamIntelligence } from "@/types";

export interface OpponentDashboardSummary {
  overallThreat: "Low" | "Medium" | "High";
  overallThreatReason: string;
  primaryPitcher: string | null;
  bestHitter: string | null;
  bestRunner: string | null;
  pitchingDepth: string;
  lastScouted: string | null;
  scoutNotesCount: number;
}

/** OPS/OBP floor for a hitter who can realistically hurt you — not just "best on their roster". */
const DANGEROUS_HITTER_RATE = 0.85;

function countDangerousHitters(intelligence: TeamIntelligence): number {
  return intelligence.profiles.filter((profile) => {
    const batting = profile.batting;
    if (!batting) return false;
    const rate = batting.ops ?? batting.obp ?? batting.avg ?? 0;
    return rate >= DANGEROUS_HITTER_RATE;
  }).length;
}

function countLeverageArms(pitching: PitcherAnalysis[]): number {
  return pitching.filter((pitcher) =>
    pitcher.roleLabels.some(
      (label) => label === "Likely Main Pitcher" || label === "High-Leverage Arm"
    )
  ).length;
}

function hasProvenAce(pitching: PitcherAnalysis[]): boolean {
  return pitching.some(
    (pitcher) =>
      pitcher.roleLabels.includes("Likely Main Pitcher") &&
      pitcher.roleConfidence !== "low"
  );
}

export function computeOverallThreat(
  intelligence: TeamIntelligence,
  pitching: PitcherAnalysis[]
): { level: "Low" | "Medium" | "High"; reason: string } {
  const { teamIdentity } = intelligence;
  const dangerousHitters = countDangerousHitters(intelligence);
  const leverageArms = countLeverageArms(pitching);
  const provenAce = hasProvenAce(pitching);
  const power = teamIdentity.power;
  const offense = teamIdentity.offensive_strength;
  const depth = teamIdentity.pitching_depth;

  if (
    dangerousHitters >= 3 &&
    power !== "Below Average" &&
    (provenAce || leverageArms >= 2)
  ) {
    return {
      level: "High",
      reason: `${dangerousHitters} hitters above ${DANGEROUS_HITTER_RATE} OPS/OBP with ${power.toLowerCase()} power and a usable pitching staff.`,
    };
  }

  if (
    offense === "High OBP Team" &&
    power === "Elite" &&
    dangerousHitters >= 2
  ) {
    return {
      level: "High",
      reason: "Elite power in a high-OBP lineup with multiple dangerous hitters.",
    };
  }

  if (
    dangerousHitters >= 2 &&
    provenAce &&
    depth !== "Limited Depth" &&
    power !== "Below Average"
  ) {
    return {
      level: "High",
      reason: "Multiple dangerous hitters plus a proven primary pitcher.",
    };
  }

  if (
    power === "Below Average" &&
    dangerousHitters < 2 &&
    !provenAce &&
    leverageArms < 2
  ) {
    return {
      level: "Low",
      reason: "Limited power, few standout hitters, and no proven front-line pitching.",
    };
  }

  if (dangerousHitters === 0 && pitching.length <= 1) {
    return {
      level: "Low",
      reason: "Thin roster data with little proven offense or pitching.",
    };
  }

  if (power === "Below Average" || offense === "Contact-Oriented") {
    return {
      level: "Medium",
      reason:
        leverageArms >= 2 || provenAce
          ? "Contact-oriented offense, but they have arms that can keep games close."
          : "Contact/patience offense without much power — pitch to contact and execute.",
    };
  }

  return {
    level: "Medium",
    reason: "Balanced opponent — some threats, but no overwhelming edge on paper.",
  };
}

export function buildOpponentDashboardSummary(
  data: OpponentDetail
): OpponentDashboardSummary {
  const intelligence = buildTeamIntelligence(data);
  const pitching = analyzePitchingStaffFromDetail(data);

  const topHitterPick = resolveBestHitterPick(intelligence.profiles);
  const topRunnerPick = resolveBestRunnerPick(intelligence.profiles);
  const topPitcher = intelligence.pitchingLeaders.ace_pitcher;

  const formatPlayer = (jersey: string | null, name: string, stat?: string) => {
    const label = jersey ? `#${jersey} ${name}` : name;
    return stat ? `${label} (${stat})` : label;
  };

  const threat = computeOverallThreat(intelligence, pitching);

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
    overallThreat: threat.level,
    overallThreatReason: threat.reason,
    primaryPitcher: topPitcher
      ? formatPlayer(topPitcher.jersey_number, topPitcher.player_name)
      : pitching[0]?.label ?? null,
    bestHitter: topHitterPick?.jersey_number
      ? formatPlayer(
          topHitterPick.jersey_number,
          topHitterPick.player_name,
          topHitterPick.stat_line
        )
      : null,
    bestRunner: topRunnerPick?.jersey_number
      ? formatPlayer(
          topRunnerPick.jersey_number,
          topRunnerPick.player_name,
          topRunnerPick.stat_line
        )
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
