import { buildCoachTakeaways } from "@/lib/scouting/coach-takeaways";
import {
  analyzePitchingStaffFromDetail,
  type PitcherAnalysis,
} from "@/lib/scouting/pitching-analysis";
import { formatPlayerDisplayLabel } from "@/lib/scouting/player-profiles";
import {
  formatConfidenceLabel,
  estimatePlateAppearances,
  offensiveSampleConfidence,
  pitchingSampleConfidence,
} from "@/lib/scouting/sample-size";
import { buildTeamIntelligence } from "@/lib/scouting/team-intelligence";
import type { OpponentDetail } from "@/types";

export interface GameDaySummaryLine {
  label: string;
  value: string;
  confidence?: string;
}

export interface GameDaySummary {
  opponentName: string;
  bestHitter: GameDaySummaryLine | null;
  primaryPitcher: GameDaySummaryLine | null;
  bestRunner: GameDaySummaryLine | null;
  pitchingDepth: string;
  biggestOpportunity: string;
  biggestThreat: string;
  gamePlan: string;
  confidenceNote: string;
}

function primaryPitcherLine(
  intelligence: ReturnType<typeof buildTeamIntelligence>,
  pitching: PitcherAnalysis[]
): GameDaySummaryLine | null {
  const ace = intelligence.pitchingLeaders.ace_pitcher;
  const main = pitching.find((p) => p.roleLabels.includes("Likely Main Pitcher"));
  const target = main ?? pitching[0];
  if (!target && !ace) return null;

  const ip = target?.inningsPitched ?? null;
  const bf =
    intelligence.profiles.find(
      (p) =>
        p.jerseyNumber === target?.jerseyNumber &&
        p.name === target?.playerName
    )?.pitching?.batters_faced ?? null;
  const confidence = pitchingSampleConfidence(ip, bf);
  const label =
    confidence === "low" ? "Likely Primary Pitcher" : "Primary Pitcher";

  return {
    label,
    value: target?.label ?? (ace ? `#${ace.jersey_number ?? ""} ${ace.player_name}`.trim() : "Unknown"),
    confidence: formatConfidenceLabel(confidence),
  };
}

export function buildGameDaySummary(
  opponentName: string,
  data: OpponentDetail
): GameDaySummary {
  const intelligence = buildTeamIntelligence(data);
  const pitching = analyzePitchingStaffFromDetail(data);
  const takeaways = buildCoachTakeaways(data, intelligence, pitching);

  const bestHitterLeader =
    intelligence.offensiveLeaders.highest_ops ??
    intelligence.offensiveLeaders.highest_avg;
  const bestRunnerLeader = intelligence.offensiveLeaders.most_stolen_bases;

  const hitterProfile = bestHitterLeader
    ? intelligence.profiles.find(
        (p) =>
          p.name === bestHitterLeader.player_name &&
          p.jerseyNumber === bestHitterLeader.jersey_number
      )
    : null;

  const hitterConfidence = hitterProfile?.batting
    ? offensiveSampleConfidence(
        null,
        estimatePlateAppearances(hitterProfile.batting)
      )
    : "medium";

  const controlRisk = pitching.find((p) => p.controlRisk === "High");
  const strikeThrower = pitching.find((p) => p.strikeThrower);
  const topHitter = intelligence.playersToAvoid[0];

  return {
    opponentName,
    bestHitter: bestHitterLeader
      ? {
          label: "Best Hitter",
          value: formatPlayerDisplayLabel({
            name: bestHitterLeader.player_name,
            jerseyNumber: bestHitterLeader.jersey_number,
          }),
          confidence: formatConfidenceLabel(hitterConfidence),
        }
      : null,
    primaryPitcher: primaryPitcherLine(intelligence, pitching),
    bestRunner: bestRunnerLeader
      ? {
          label: "Best Runner",
          value: formatPlayerDisplayLabel({
            name: bestRunnerLeader.player_name,
            jerseyNumber: bestRunnerLeader.jersey_number,
          }),
        }
      : null,
    pitchingDepth: intelligence.teamIdentity.pitching_depth,
    biggestOpportunity: controlRisk
      ? `Attack ${controlRisk.label} — high walk rate`
      : pitching.length >= 3
        ? "Attack secondary pitchers"
        : takeaways.find((t) => t.toLowerCase().includes("depth")) ??
          "Look for pitching depth advantages",
    biggestThreat: topHitter
      ? `${formatPlayerDisplayLabel({
          name: topHitter.player_name,
          jerseyNumber: topHitter.jersey_number,
        })} — ${topHitter.assessment}`
      : strikeThrower
        ? "Strike-throwing staff — expect early-count swings"
        : "Patient lineup — works counts",
    gamePlan: takeaways.slice(0, 3).join(" "),
    confidenceNote: `Offense: ${intelligence.confidenceByCategory.offense} · Pitching: ${intelligence.confidenceByCategory.pitching}`,
  };
}
