import { parseBaseballInnings } from "@/lib/scouting/innings";
import {
  formatPitcherLabel,
  playerLedgerKey,
} from "@/lib/scouting/ledger-build";
import { normalizeRules } from "@/lib/scouting/pitching-rules";
import type {
  PitchingAvailability,
  PitchingLedgerEntry,
  PitchingLedgerOutlook,
  PitchingRulesConfig,
  PitcherLedgerSummary,
} from "@/types";

/** Local calendar date YYYY-MM-DD (avoids UTC drift). */
export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

export interface AvailabilityOptions {
  /** Calendar day the report is generated; defaults to local today. */
  referenceDate?: string;
  /** Day availability is evaluated for; defaults to day after referenceDate. */
  targetDate?: string;
  /** Days before referenceDate to include (default 2 → today + 2 prior days). */
  lookbackDays?: number;
  /** When set, only this tournament's entries count toward workload. */
  tournamentName?: string | null;
}

export interface AvailabilityWindow {
  referenceDate: string;
  targetDate: string;
  windowStart: string;
  windowEnd: string;
  tournamentName: string | null;
}

export function resolveAvailabilityWindow(
  options?: AvailabilityOptions
): AvailabilityWindow {
  const referenceDate = options?.referenceDate ?? getLocalDateString();
  const lookbackDays = options?.lookbackDays ?? 2;
  return {
    referenceDate,
    targetDate: options?.targetDate ?? addCalendarDays(referenceDate, 1),
    windowStart: addCalendarDays(referenceDate, -lookbackDays),
    windowEnd: referenceDate,
    tournamentName: options?.tournamentName ?? null,
  };
}

/** Entries whose game_date falls in [endDate - lookbackDays, endDate]. */
export function entriesInDateWindow(
  entries: PitchingLedgerEntry[],
  endDate: string,
  lookbackDays: number
): PitchingLedgerEntry[] {
  const startDate = addCalendarDays(endDate, -lookbackDays);
  return entries.filter((e) => {
    const gd = e.game_date?.slice(0, 10);
    if (!gd) return false;
    return gd >= startDate && gd <= endDate;
  });
}

/**
 * Scope workload for availability. Tournament name is optional:
 * - explicit tournamentName → filter to that tournament
 * - else if all dated entries in the window share one name → use it
 * - else → date window only (today + lookbackDays)
 */
export function scopeEntriesForAvailability(
  entries: PitchingLedgerEntry[],
  window: AvailabilityWindow
): PitchingLedgerEntry[] {
  const lookback =
    window.windowEnd === window.referenceDate
      ? Math.round(
          (new Date(`${window.windowEnd}T12:00:00`).getTime() -
            new Date(`${window.windowStart}T12:00:00`).getTime()) /
            86400000
        )
      : 2;

  const windowed = entriesInDateWindow(
    entries,
    window.windowEnd,
    lookback
  );

  if (window.tournamentName) {
    const byName = entries.filter(
      (e) => e.tournament_name === window.tournamentName
    );
    return byName.length ? byName : windowed;
  }

  const names = [
    ...new Set(
      windowed.map((e) => e.tournament_name).filter((n): n is string => !!n)
    ),
  ];
  if (names.length === 1) {
    return entries.filter((e) => e.tournament_name === names[0]);
  }

  return windowed;
}

export function formatAvailabilityWindowLabel(window: AvailabilityWindow): string {
  const start = new Date(`${window.windowStart}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" }
  );
  const end = new Date(`${window.windowEnd}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" }
  );
  const target = new Date(`${window.targetDate}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" }
  );
  const scope = window.tournamentName
    ? `tournament “${window.tournamentName}”`
    : `games ${start}–${end}`;
  return `Availability for ${target} based on ${scope}.`;
}

function isBracketGame(gameType: string | null | undefined): boolean {
  return ["bracket_play", "quarterfinal", "semifinal", "championship"].includes(
    gameType ?? ""
  );
}

function isChampionship(gameType: string | null | undefined): boolean {
  return gameType === "championship";
}

function isPool(gameType: string | null | undefined): boolean {
  return gameType === "pool_play";
}

function sumInnings(entries: PitchingLedgerEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + parseBaseballInnings(e.innings_pitched ?? 0),
    0
  );
}

function sumPitches(entries: PitchingLedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.pitch_count ?? 0), 0);
}

function sumStrikes(entries: PitchingLedgerEntry[]): number | null {
  const withStrikes = entries.filter((e) => e.strikes != null);
  if (!withStrikes.length) return null;
  return withStrikes.reduce((sum, e) => sum + (e.strikes ?? 0), 0);
}

function inningsOnDate(entries: PitchingLedgerEntry[], date: string): number {
  return sumInnings(entries.filter((e) => e.game_date?.slice(0, 10) === date));
}

export function computeImportanceScore(
  summary: Omit<
    PitcherLedgerSummary,
    | "importanceScore"
    | "importanceAssessment"
    | "availability"
    | "availabilityConfidence"
    | "remainingInningsEstimate"
    | "weekendCapacityPct"
    | "roleLabels"
  >
): { score: number; assessment: string } {
  const bracketWeight = summary.bracketAppearances * 12;
  const championshipWeight = summary.championshipAppearances * 20;
  const inningsWeight = Math.min(summary.totalInnings * 4, 40);
  const pitchWeight = Math.min(summary.totalPitches * 0.08, 15);
  const finishWeight = summary.finishedGames * 8;

  const score = Math.min(
    100,
    Math.round(
      bracketWeight + championshipWeight + inningsWeight + pitchWeight + finishWeight
    )
  );

  let assessment = "Depth arm — limited high-leverage usage observed.";
  if (score >= 85) assessment = "Most trusted arm on roster.";
  else if (score >= 65)
    assessment = "Primary tournament pitcher — expect in bracket games.";
  else if (score >= 40) assessment = "Regular contributor — situational usage.";

  return { score, assessment };
}

export function computeAvailability(
  entries: PitchingLedgerEntry[],
  rulesInput?: PitchingRulesConfig | null,
  options?: AvailabilityOptions
): {
  status: PitchingAvailability;
  confidence: "low" | "medium" | "high";
  remainingInnings: number | null;
  weekendCapacityPct: number | null;
} {
  const rules = normalizeRules(rulesInput);
  const window = resolveAvailabilityWindow(options);
  const scoped = scopeEntriesForAvailability(entries, window);
  const workloadEntries = scoped.length ? scoped : entries;

  const totalInnings = sumInnings(workloadEntries);
  const cap = rules.tournament_innings_cap ?? 8;
  const remaining = Math.max(0, cap - totalInnings);
  const weekendCapacityPct =
    cap > 0 ? Math.round((remaining / cap) * 100) : null;

  const dayBeforeTarget = addCalendarDays(window.targetDate, -1);
  const priorDayIp = inningsOnDate(entries, dayBeforeTarget);

  const hasDatedEntries = entries.some((e) => e.game_date?.slice(0, 10));
  const confidenceBase: "low" | "medium" | "high" =
    !hasDatedEntries ? "low" : scoped.length >= 2 ? "high" : "medium";

  if (priorDayIp >= (rules.max_innings_per_day ?? 6)) {
    return {
      status: "unavailable",
      confidence: priorDayIp > 0 ? "high" : confidenceBase,
      remainingInnings: remaining,
      weekendCapacityPct,
    };
  }

  if (
    priorDayIp > (rules.innings_trigger_rest_day ?? 3) &&
    (rules.rest_days_after_heavy_day ?? 1) >= 1
  ) {
    return {
      status: "unavailable",
      confidence: priorDayIp > 0 ? "high" : confidenceBase,
      remainingInnings: remaining,
      weekendCapacityPct,
    };
  }

  if (priorDayIp >= (rules.innings_trigger_rest_day ?? 3)) {
    return {
      status: "limited",
      confidence: priorDayIp > 0 ? "high" : confidenceBase,
      remainingInnings: Math.min(remaining, 2),
      weekendCapacityPct,
    };
  }

  const rollingDays = rules.rolling_window_days ?? 3;
  const rollingMax = rules.max_innings_rolling_window ?? 8;
  const rollingStart = addCalendarDays(window.targetDate, -(rollingDays - 1));
  const rollingIp = sumInnings(
    entries.filter((e) => {
      const gd = e.game_date?.slice(0, 10);
      return gd && gd >= rollingStart && gd <= dayBeforeTarget;
    })
  );
  if (rollingIp >= rollingMax) {
    return {
      status: "limited",
      confidence: confidenceBase,
      remainingInnings: Math.max(0, rollingMax - rollingIp),
      weekendCapacityPct,
    };
  }

  if (remaining <= 1) {
    return {
      status: "emergency_only",
      confidence: confidenceBase,
      remainingInnings: remaining,
      weekendCapacityPct,
    };
  }

  if (remaining <= 2.5) {
    return {
      status: "limited",
      confidence: confidenceBase,
      remainingInnings: remaining,
      weekendCapacityPct,
    };
  }

  return {
    status: "available",
    confidence: confidenceBase,
    remainingInnings: remaining,
    weekendCapacityPct,
  };
}

function computeAceScore(summary: PitcherLedgerSummary): number {
  const inningsComponent = Math.min(summary.totalInnings / 8, 1) * 40;
  const bracketComponent = Math.min(summary.bracketAppearances / 4, 1) * 25;
  const championshipComponent =
    Math.min(summary.championshipAppearances / 2, 1) * 15;
  const leverageComponent =
    summary.appearances.filter((a) =>
      ["high", "critical"].includes(a.leverage ?? "")
    ).length > 0
      ? 10
      : 0;
  const pitchComponent = Math.min(summary.totalPitches / 120, 1) * 10;
  return (
    inningsComponent +
    bracketComponent +
    championshipComponent +
    leverageComponent +
    pitchComponent
  );
}

function detectRoles(summary: PitcherLedgerSummary): string[] {
  const roles: string[] = [];
  if (summary.finishedGames >= 3) roles.push("Likely Closer");
  if (summary.bracketAppearances >= 2 && summary.totalInnings >= 4) {
    roles.push("Bracket Arm");
  }
  if (summary.championshipAppearances >= 1) roles.push("Championship Usage");
  if (summary.appearances.some((a) => a.started_game)) roles.push("Starter");
  if (summary.appearances.some((a) => a.entered_inning && !a.started_game)) {
    roles.push("Relief");
  }
  return roles;
}

export function buildPitcherSummaries(
  entries: PitchingLedgerEntry[],
  rules?: PitchingRulesConfig | null,
  options?: AvailabilityOptions
): PitcherLedgerSummary[] {
  const window = resolveAvailabilityWindow(options);
  const byPlayer = new Map<string, PitchingLedgerEntry[]>();

  for (const entry of entries) {
    const key = playerLedgerKey(entry);
    const list = byPlayer.get(key) ?? [];
    list.push(entry);
    byPlayer.set(key, list);
  }

  const summaries: PitcherLedgerSummary[] = [];

  for (const [playerKey, appearances] of byPlayer) {
    const scoped = scopeEntriesForAvailability(appearances, window);
    const hasUndated = appearances.some((e) => !e.game_date?.slice(0, 10));
    const workload = scoped.length ? scoped : hasUndated ? appearances : [];
    if (!workload.length) continue;

    const sorted = [...workload].sort((a, b) =>
      (a.game_date ?? "").localeCompare(b.game_date ?? "")
    );
    if (!sorted.length) continue;

    const first = sorted[0];
    const totalInnings = sumInnings(sorted);
    const totalPitches = sumPitches(sorted);
    const totalStrikes = sumStrikes(sorted);

    const base = {
      playerKey,
      playerName: first.player_name,
      jerseyNumber: first.jersey_number,
      label: formatPitcherLabel(first),
      totalInnings,
      totalPitches,
      totalStrikes,
      gameCount: sorted.length,
      poolAppearances: sorted.filter((a) => isPool(a.game_type)).length,
      bracketAppearances: sorted.filter((a) => isBracketGame(a.game_type)).length,
      championshipAppearances: sorted.filter((a) =>
        isChampionship(a.game_type)
      ).length,
      finishedGames: sorted.filter((a) => a.finished_game).length,
      appearances: sorted,
    };

    const importance = computeImportanceScore(base);
    const availability = computeAvailability(appearances, rules, options);
    const roleLabels = detectRoles({
      ...base,
      importanceScore: importance.score,
      importanceAssessment: importance.assessment,
      availability: availability.status,
      availabilityConfidence: availability.confidence,
      remainingInningsEstimate: availability.remainingInnings,
      weekendCapacityPct: availability.weekendCapacityPct,
      roleLabels: [],
    });

    summaries.push({
      ...base,
      importanceScore: importance.score,
      importanceAssessment: importance.assessment,
      availability: availability.status,
      availabilityConfidence: availability.confidence,
      remainingInningsEstimate: availability.remainingInnings,
      weekendCapacityPct: availability.weekendCapacityPct,
      roleLabels,
    });
  }

  return summaries.sort((a, b) => b.importanceScore - a.importanceScore);
}

export function buildPitchingLedgerOutlook(
  summaries: PitcherLedgerSummary[]
): PitchingLedgerOutlook {
  const ace =
    [...summaries].sort((a, b) => computeAceScore(b) - computeAceScore(a))[0] ??
    null;

  const likelyCloser =
    summaries.find((s) => s.roleLabels.includes("Likely Closer")) ?? null;

  const likelyStarter =
    summaries.find(
      (s) =>
        s.availability !== "unavailable" &&
        (s.roleLabels.includes("Starter") || s.importanceScore >= 60)
    ) ?? ace;

  const primaryRelief =
    summaries.find(
      (s) =>
        s.playerKey !== likelyStarter?.playerKey &&
        s.availability === "available" &&
        s.roleLabels.includes("Relief")
    ) ??
    summaries.find(
      (s) =>
        s.playerKey !== likelyStarter?.playerKey &&
        s.availability === "available" &&
        s.importanceScore >= 40
    ) ??
    null;

  const unavailable = summaries.filter((s) => s.availability === "unavailable");
  const limited = summaries.filter((s) => s.availability === "limited");
  const available = summaries.filter((s) => s.availability === "available");

  const pitcherCount = summaries.length;
  const depthRating =
    pitcherCount >= 4 && available.length >= 2
      ? "Deep"
      : pitcherCount >= 2
        ? "Moderate"
        : "Thin";

  return {
    ace,
    likelyStarter: likelyStarter ?? null,
    primaryRelief,
    likelyCloser,
    unavailable,
    limited,
    available,
    depthRating,
  };
}

export function formatAvailability(status: PitchingAvailability): string {
  switch (status) {
    case "available":
      return "Available";
    case "limited":
      return "Limited";
    case "emergency_only":
      return "Emergency Only";
    case "unavailable":
      return "Unavailable";
  }
}

export function formatTournamentPitchingIntelligence(
  summaries: PitcherLedgerSummary[],
  outlook: PitchingLedgerOutlook
): string {
  if (!summaries.length) return "";
  const lines: string[] = ["Tournament Pitching Intelligence", ""];

  if (outlook.ace) {
    lines.push(
      `Ace: ${outlook.ace.label}`,
      `Availability: ${formatAvailability(outlook.ace.availability)}`,
      `Remaining Capacity: ${outlook.ace.remainingInningsEstimate ?? "—"} innings`,
      `Bracket Usage: ${outlook.ace.bracketAppearances} appearances`,
      `Championship Usage: ${outlook.ace.championshipAppearances} appearances`,
      `Assessment: ${outlook.ace.importanceAssessment}`,
      ""
    );
  }

  if (outlook.likelyCloser) {
    lines.push(`Likely Closer: ${outlook.likelyCloser.label}`, "");
  }

  if (outlook.unavailable.length) {
    lines.push(
      `Unavailable: ${outlook.unavailable.map((p) => p.label).join(", ")}`,
      ""
    );
  }

  lines.push(`Staff Depth: ${outlook.depthRating}`);
  return lines.join("\n");
}

export function formatGameTypeLabel(
  gameType: string | null | undefined
): string {
  const map: Record<string, string> = {
    pool_play: "Pool Play",
    bracket_play: "Bracket",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    championship: "Championship",
    friendly: "Friendly",
    scrimmage: "Scrimmage",
    unknown: "Unknown",
  };
  return map[gameType ?? "unknown"] ?? gameType ?? "Unknown";
}
