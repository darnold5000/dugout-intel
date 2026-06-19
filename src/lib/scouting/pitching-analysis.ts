import { parseBaseballInnings, formatBaseballInnings } from "@/lib/scouting/innings";
import {
  formatPlayerDisplayLabel,
  getConsolidatedPitchingStats,
} from "@/lib/scouting/player-profiles";
import {
  formatConfidenceLabel,
  pitchingRoleWithSampleSize,
  pitchingSampleConfidence,
} from "@/lib/scouting/sample-size";
import type {
  ExtractedPitchingStat,
  OpponentDetail,
  OpponentGameContext,
  OpponentNote,
  OpponentVoiceNote,
} from "@/types";

export type PitcherRoleLabel =
  | "Likely Main Pitcher"
  | "High-Leverage Arm"
  | "Strike Thrower"
  | "Wild But Effective"
  | "Contact Pitcher"
  | "Emergency / Depth Arm";

export interface PitcherAnalysis {
  playerName: string | null;
  jerseyNumber: string | null;
  label: string;
  roleLabels: PitcherRoleLabel[];
  roleConfidence: "low" | "medium" | "high";
  /** Coach-facing summary fields */
  role: string;
  workload: "Heavy" | "Medium" | "Light" | "Unknown";
  strikeThrower: boolean;
  controlRisk: "Low" | "Medium" | "High";
  likelyUsage: string;
  inningsPitched: number | null;
  inningsPitchedDisplay: string | null;
  pitches: number | null;
  strikes: number | null;
  balls: number | null;
  strikePercentage: number | null;
  walks: number | null;
  strikeouts: number | null;
  hitsAllowed: number | null;
  era: number | null;
  whip: number | null;
  pitchesPerInning: number | null;
  walksPerInning: number | null;
  strikeoutsPerInning: number | null;
  evidence: string[];
  coachTakeaway: string;
  bracketAppearances: number;
  highLeverageSignals: number;
}

function computeWhip(stat: ExtractedPitchingStat): number | null {
  if (stat.innings_pitched == null || stat.innings_pitched <= 0) return null;
  const ip = parseBaseballInnings(stat.innings_pitched);
  const bb = stat.walks ?? 0;
  const h = stat.hits_allowed ?? 0;
  if (stat.walks == null && stat.hits_allowed == null) return null;
  return (bb + h) / ip;
}

function deriveStrikesBalls(
  pitches: number | null,
  strikePct: number | null
): { strikes: number | null; balls: number | null } {
  if (pitches == null || strikePct == null) return { strikes: null, balls: null };
  const strikes = Math.round(pitches * strikePct);
  return { strikes, balls: pitches - strikes };
}

function isBracketContext(gameType: string | null | undefined): boolean {
  return gameType === "bracket_play" || gameType === "championship";
}

function noteMentionsPitcher(
  text: string,
  jersey: string | null,
  name: string | null
): boolean {
  const lower = text.toLowerCase();
  if (jersey && (lower.includes(`#${jersey}`) || lower.includes(`number ${jersey}`))) {
    return true;
  }
  if (name) {
    const parts = name.toLowerCase().split(/\s+/);
    return parts.some((p) => p.length > 2 && lower.includes(p));
  }
  return false;
}

export function analyzePitchingStaffFromDetail(
  data: OpponentDetail
): PitcherAnalysis[] {
  return analyzePitchingStaff(
    getConsolidatedPitchingStats(data),
    data.opponent_notes ?? [],
    data.opponent_voice_notes ?? [],
    data.opponent_game_context ?? []
  );
}

export function analyzePitchingStaff(
  pitchingStats: ExtractedPitchingStat[],
  notes: OpponentNote[] = [],
  voiceNotes: OpponentVoiceNote[] = [],
  gameContexts: OpponentGameContext[] = []
): PitcherAnalysis[] {
  if (pitchingStats.length === 0) return [];

  const maxIp = Math.max(
    ...pitchingStats.map((s) =>
      s.innings_pitched != null ? parseBaseballInnings(s.innings_pitched) : 0
    )
  );
  const maxPitches = Math.max(...pitchingStats.map((s) => s.pitches ?? 0));

  const highLeverageContexts = gameContexts.filter(
    (c) => c.leverage === "high" || isBracketContext(c.game_type)
  );

  return pitchingStats
    .filter((s) => s.innings_pitched != null || s.pitches != null)
    .map((stat) => {
      const ip =
        stat.innings_pitched != null
          ? parseBaseballInnings(stat.innings_pitched)
          : null;
      const { strikes, balls } = deriveStrikesBalls(
        stat.pitches,
        stat.strike_percentage
      );
      const whip = computeWhip(stat);
      const evidence: string[] = [];
      const roleLabels: PitcherRoleLabel[] = [];
      let score = 0;

      if (ip != null) {
        evidence.push(`Threw ${formatBaseballInnings(ip)} innings across available data`);
        if (ip >= maxIp * 0.9 && maxIp > 0) {
          score += 3;
          evidence.push("Highest or near-highest innings workload");
        }
      }

      if (stat.pitches != null && stat.pitches >= maxPitches * 0.9 && maxPitches > 0) {
        score += 2;
        evidence.push(`Highest pitch count (${stat.pitches} pitches)`);
      }

      if (stat.strike_percentage != null) {
        const pct = (stat.strike_percentage * 100).toFixed(1);
        evidence.push(`${strikes ?? "?"} strikes / ${balls ?? "?"} balls (${pct}% strikes)`);
        if (stat.strike_percentage >= 0.62) {
          roleLabels.push("Strike Thrower");
          score += 1;
        } else if (stat.strike_percentage < 0.5) {
          score -= 1;
        }
      }

      if (stat.walks != null && ip != null && ip > 0) {
        const wpi = stat.walks / ip;
        if (wpi >= 1.5) evidence.push("High walk rate per inning");
      }

      const relatedNotes = [...notes, ...voiceNotes].filter((n) =>
        noteMentionsPitcher(
          "note_text" in n ? n.note_text : n.transcript_text ?? "",
          stat.jersey_number,
          stat.player_name
        )
      );

      let bracketAppearances = 0;
      let highLeverageSignals = 0;

      for (const note of relatedNotes) {
        if (isBracketContext(note.game_type)) {
          bracketAppearances++;
          score += 2;
          evidence.push("Note-based: appeared in bracket/championship context");
        }
        const text =
          "note_text" in note ? note.note_text : note.transcript_text ?? "";
        if (/after starter|relief|came in|entered/i.test(text)) {
          score += 2;
          highLeverageSignals++;
          evidence.push("Note-based: entered after starter trouble or as relief");
        }
        if (/main pitcher|best arm|ace|closer/i.test(text)) {
          score += 3;
          evidence.push("Note-based: described as trusted/main arm");
        }
      }

      for (const ctx of highLeverageContexts) {
        if (
          ctx.notes &&
          noteMentionsPitcher(ctx.notes, stat.jersey_number, stat.player_name)
        ) {
          if (isBracketContext(ctx.game_type)) bracketAppearances++;
          if (ctx.leverage === "high") highLeverageSignals++;
        }
      }

      if (bracketAppearances > 0) {
        score += 2;
        roleLabels.push("High-Leverage Arm");
      }

      if (whip != null && whip < 1.5) score += 1;
      if (stat.era != null && stat.era < 3) score += 1;

      if (score >= 6) roleLabels.unshift("Likely Main Pitcher");
      else if (score >= 3) roleLabels.push("High-Leverage Arm");
      else if (ip != null && ip < 1) roleLabels.push("Emergency / Depth Arm");
      else if (
        stat.strike_percentage != null &&
        stat.strike_percentage < 0.5 &&
        stat.era != null &&
        stat.era < 4
      ) {
        roleLabels.push("Wild But Effective");
      } else {
        roleLabels.push("Contact Pitcher");
      }

      const bf = stat.batters_faced;
      const sampleConfidence = pitchingSampleConfidence(ip, bf);
      const uniqueRoles = Array.from(new Set(roleLabels));
      const roleConfidence: "low" | "medium" | "high" =
        sampleConfidence === "low"
          ? "low"
          : score >= 6
            ? "high"
            : score >= 3
              ? "medium"
              : "low";

      const label = formatPlayerDisplayLabel({
        name: stat.player_name,
        jerseyNumber: stat.jersey_number,
      });

      let coachTakeaway = "";
      if (uniqueRoles.includes("Likely Main Pitcher")) {
        coachTakeaway =
          "Our hitters: expect them in important innings; be ready early in counts if strike % is strong.";
      } else if (uniqueRoles.includes("Strike Thrower")) {
        coachTakeaway =
          "Our hitters: they attack the zone — be ready to swing on hittable first-pitch strikes.";
      } else if (uniqueRoles.includes("Wild But Effective")) {
        coachTakeaway =
          "Our hitters: patient approach may force mistakes when they fall behind.";
      } else {
        coachTakeaway =
          "Our approach: treat as depth unless bracket notes indicate higher leverage usage.";
      }

      const strikeThrower =
        stat.strike_percentage != null && stat.strike_percentage >= 0.62;
      const walksPerInning =
        ip != null && ip > 0 && stat.walks != null ? stat.walks / ip : null;
      let controlRisk: "Low" | "Medium" | "High" = "Medium";
      if (walksPerInning != null) {
        if (walksPerInning < 0.5) controlRisk = "Low";
        else if (walksPerInning >= 1) controlRisk = "High";
      }

      let workload: "Heavy" | "Medium" | "Light" | "Unknown" = "Unknown";
      if (ip != null) {
        if (ip >= 4 || (stat.pitches ?? 0) >= maxPitches * 0.85) workload = "Heavy";
        else if (ip >= 2) workload = "Medium";
        else workload = "Light";
      }

      let role = "Depth";
      if (uniqueRoles.includes("Likely Main Pitcher")) {
        role =
          sampleConfidence === "low"
            ? pitchingRoleWithSampleSize("Likely Primary Pitcher", sampleConfidence, ip)
            : "Primary Pitcher";
      } else if (uniqueRoles.includes("High-Leverage Arm")) role = "High-Leverage";
      else if (uniqueRoles.includes("Strike Thrower")) role = "Strike Thrower";

      let likelyUsage = "Unknown usage";
      if (bracketAppearances > 0 && highLeverageSignals > 0) {
        likelyUsage = "Bracket relief / high-leverage";
      } else if (bracketAppearances > 0) {
        likelyUsage = "Bracket game appearance";
      } else if (uniqueRoles.includes("Likely Main Pitcher")) {
        likelyUsage = "Likely bracket starter";
      } else if (workload === "Heavy") {
        likelyUsage = "Primary workload arm";
      } else if (workload === "Light") {
        likelyUsage = "Spot / depth usage";
      }

      if (stat.pitches != null && ip != null && ip > 0) {
        const ppi = stat.pitches / ip;
        if (ppi >= 20) {
          evidence.push(`High workload: ${ppi.toFixed(0)} pitches per inning`);
        } else if (ppi <= 12) {
          evidence.push(`Efficient: ${ppi.toFixed(0)} pitches per inning`);
        }
      }

      if (stat.strike_percentage != null && stat.strike_percentage < 0.5) {
        evidence.push("Wild pitcher — sub-50% strike rate");
      }

      return {
        playerName: stat.player_name,
        jerseyNumber: stat.jersey_number,
        label,
        roleLabels: uniqueRoles,
        roleConfidence,
        role,
        workload,
        strikeThrower,
        controlRisk,
        likelyUsage,
        inningsPitched: ip,
        inningsPitchedDisplay: ip != null ? formatBaseballInnings(ip) : null,
        pitches: stat.pitches,
        strikes,
        balls,
        strikePercentage: stat.strike_percentage,
        walks: stat.walks,
        strikeouts: stat.strikeouts,
        hitsAllowed: stat.hits_allowed,
        era: stat.era,
        whip,
        pitchesPerInning:
          ip != null && ip > 0 && stat.pitches != null ? stat.pitches / ip : null,
        walksPerInning:
          ip != null && ip > 0 && stat.walks != null ? stat.walks / ip : null,
        strikeoutsPerInning:
          ip != null && ip > 0 && stat.strikeouts != null
            ? stat.strikeouts / ip
            : null,
        evidence: [
          ...evidence,
          `Confidence: ${formatConfidenceLabel(sampleConfidence)}`,
        ],
        coachTakeaway,
        bracketAppearances,
        highLeverageSignals,
      };
    })
    .sort((a, b) => (b.inningsPitched ?? 0) - (a.inningsPitched ?? 0));
}

export function formatPitchingStaffRead(analyses: PitcherAnalysis[]): string {
  if (analyses.length === 0) return "No pitching data available.";

  return analyses
    .map((p) => {
      const lines = [
        `## ${p.label}`,
        `Role: ${p.roleLabels.join(" / ")} (${p.roleConfidence} confidence)`,
        "",
        "Evidence:",
        ...p.evidence.map((e) => `- ${e}`),
        "",
        "Pitch Profile:",
        p.pitches != null ? `- ${p.pitches} pitches` : null,
        p.strikes != null && p.balls != null
          ? `- ${p.strikes} strikes / ${p.balls} balls`
          : null,
        p.strikePercentage != null
          ? `- ${(p.strikePercentage * 100).toFixed(1)}% strikes`
          : null,
        p.inningsPitchedDisplay ? `- ${p.inningsPitchedDisplay} IP` : null,
        "",
        `Coach Takeaway: ${p.coachTakeaway}`,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n---\n\n");
}
