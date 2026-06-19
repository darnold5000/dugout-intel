import type { PitcherAnalysis } from "@/lib/scouting/pitching-analysis";
import type { TeamIntelligence } from "@/types";
import type { OpponentDetail } from "@/types";

export function buildCoachTakeaways(
  data: OpponentDetail,
  intelligence: TeamIntelligence,
  pitchingAnalyses: PitcherAnalysis[]
): string[] {
  const takeaways: string[] = [];

  const pitchersOver4Ip = pitchingAnalyses.filter(
    (p) => (p.inningsPitched ?? 0) >= 4
  ).length;

  if (pitchingAnalyses.length > 0) {
    if (pitchersOver4Ip === 0) {
      takeaways.push(
        "No pitcher has thrown more than 4 innings in available data — workload is unclear."
      );
    } else if (pitchersOver4Ip === 1) {
      takeaways.push("Only one pitcher has thrown more than 4 innings.");
    } else {
      takeaways.push(
        `${pitchersOver4Ip} pitchers have thrown 4+ innings — some rotation depth exists.`
      );
    }
  }

  const mainArm = pitchingAnalyses.find((p) =>
    p.roleLabels.includes("Likely Main Pitcher")
  );
  if (mainArm) {
    takeaways.push(`${mainArm.label} appears to be the primary arm.`);
  }

  const highLeverage = pitchingAnalyses.find((p) =>
    p.roleLabels.includes("High-Leverage Arm")
  );
  if (highLeverage && highLeverage.label !== mainArm?.label) {
    takeaways.push(
      `${highLeverage.label} shows high-leverage or bracket usage signals.`
    );
  }

  if (intelligence.teamIdentity?.pitching_depth) {
    const depth = intelligence.teamIdentity.pitching_depth.toLowerCase();
    if (depth.includes("limited") || depth.includes("shallow")) {
      takeaways.push("Team has limited pitching depth.");
    }
  }

  const topHitter =
    intelligence.offensiveLeaders.highest_ops ??
    intelligence.offensiveLeaders.highest_avg;
  if (topHitter) {
    const label = topHitter.jersey_number
      ? `#${topHitter.jersey_number} ${topHitter.player_name}`
      : topHitter.player_name;
    takeaways.push(`Offense relies heavily on ${label}.`);
  }

  const hasSbData = (data.extracted_batting_stats ?? []).some(
    (s) => (s.stolen_bases ?? 0) > 0
  );
  const runningNotes = [...(data.opponent_notes ?? []), ...(data.opponent_voice_notes ?? [])].some(
    (n) =>
      /stolen|steal|baserun|speed on bases/i.test(
        "note_text" in n ? n.note_text : n.transcript_text ?? ""
      )
  );
  if (!hasSbData && !runningNotes) {
    takeaways.push("No evidence of an advanced running game.");
  } else if (hasSbData) {
    const topRunner = intelligence.offensiveLeaders.most_stolen_bases;
    if (topRunner) {
      takeaways.push(`Baserunning threat: ${topRunner.player_name} (${topRunner.stat_line}).`);
    }
  }

  const bracketContexts = (data.opponent_game_context ?? []).filter(
    (c) => c.game_type === "bracket_play" || c.game_type === "championship"
  ).length;
  if (bracketContexts > 0) {
    takeaways.push(
      `${bracketContexts} bracket/championship context note(s) — weight those observations heavily.`
    );
  }

  const recentWins = (data.extracted_games ?? []).filter((g) =>
    g.result?.toLowerCase().startsWith("w")
  ).length;
  const recentLosses = (data.extracted_games ?? []).filter((g) =>
    g.result?.toLowerCase().startsWith("l")
  ).length;
  if (recentWins + recentLosses > 0) {
    takeaways.push(
      `Recent record from screenshots: ${recentWins}-${recentLosses} (W-L).`
    );
  }

  if (takeaways.length === 0 && intelligence.dataGaps.length > 0) {
    takeaways.push("Add scout notes or box scores to build coach takeaways.");
  }

  return takeaways.slice(0, 6);
}
