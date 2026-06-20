import { parseBaseballInnings } from "@/lib/scouting/innings";
import type { AIExtractionResult } from "@/types";

type BattingRow = AIExtractionResult["batting_stats"][number];
type PitchingRow = AIExtractionResult["pitching_stats"][number];

export const BATTING_COUNTING_FIELDS = [
  "hits",
  "walks",
  "strikeouts",
  "rbi",
  "runs",
  "stolen_bases",
] as const;

export const BATTING_RATE_FIELDS = ["avg", "obp", "ops"] as const;

export const PITCHING_COUNTING_FIELDS = [
  "innings_pitched",
  "batters_faced",
  "strikes",
  "walks",
  "strikeouts",
  "hits_allowed",
  "runs_allowed",
  "earned_runs",
  "one_two_three_innings",
  "leadoff_outs",
] as const;

export const PITCHING_RATE_FIELDS = [
  "strike_percentage",
  "first_pitch_strike_pct",
  "era",
  "k_bb_ratio",
  "walks_per_inning",
  "pitches_per_inning",
  "pitches_per_batter_faced",
  "swing_miss_pct",
  "baa",
  "babip",
  "fip",
] as const;

export function sumBaseballInnings(a: number, b: number): number {
  const total = parseBaseballInnings(a) + parseBaseballInnings(b);
  const whole = Math.floor(total);
  const thirds = Math.round((total - whole) * 3);
  if (thirds <= 0) return whole;
  if (thirds === 1) return whole + 0.1;
  if (thirds === 2) return whole + 0.2;
  return whole + 1;
}

function hasSeasonBattingRates(row: BattingRow): boolean {
  return row.avg != null || row.obp != null || row.ops != null;
}

function hasSeasonPitchingRates(row: PitchingRow): boolean {
  return (
    row.era != null ||
    row.baa != null ||
    row.fip != null ||
    row.first_pitch_strike_pct != null
  );
}

export function shouldSumBattingField(
  field: (typeof BATTING_COUNTING_FIELDS)[number],
  existing: BattingRow,
  incoming: BattingRow,
  isNewUpload: boolean
): boolean {
  if (!isNewUpload) return false;
  if (hasSeasonBattingRates(existing) && hasSeasonBattingRates(incoming)) {
    return false;
  }
  return true;
}

export function shouldSumPitchingField(
  field: (typeof PITCHING_COUNTING_FIELDS)[number],
  existing: PitchingRow,
  incoming: PitchingRow,
  isNewUpload: boolean
): boolean {
  if (!isNewUpload) return false;
  if (hasSeasonPitchingRates(existing) && hasSeasonPitchingRates(incoming)) {
    return false;
  }
  return true;
}

export function sumCountingValues(
  field: string,
  current: number,
  incoming: number
): number {
  if (field === "innings_pitched") {
    return sumBaseballInnings(current, incoming);
  }
  return current + incoming;
}

export function recalculatePitchingRates(row: PitchingRow): PitchingRow {
  const pitches = row.total_pitches ?? row.pitches;
  if (pitches != null && pitches > 0 && row.strikes != null) {
    row.strike_percentage = (row.strikes / pitches) * 100;
  }
  if (
    row.strikeouts != null &&
    row.walks != null &&
    row.walks > 0
  ) {
    row.k_bb_ratio = row.strikeouts / row.walks;
  } else if (row.strikeouts != null && row.walks === 0) {
    row.k_bb_ratio = row.strikeouts;
  }
  const ip =
    row.innings_pitched != null
      ? parseBaseballInnings(row.innings_pitched)
      : null;
  if (ip != null && ip > 0) {
    if (row.walks != null) row.walks_per_inning = row.walks / ip;
    if (pitches != null) row.pitches_per_inning = pitches / ip;
  }
  if (pitches != null && row.batters_faced != null && row.batters_faced > 0) {
    row.pitches_per_batter_faced = pitches / row.batters_faced;
  }
  return row;
}

export function mergeBattingRowsAccumulating(
  existing: BattingRow,
  incoming: BattingRow,
  isNewUpload: boolean
): BattingRow {
  const merged = { ...existing };

  for (const field of BATTING_COUNTING_FIELDS) {
    const inc = incoming[field];
    if (inc == null) continue;
    const cur = merged[field];
    if (cur == null) {
      merged[field] = inc;
      continue;
    }
    if (shouldSumBattingField(field, existing, incoming, isNewUpload)) {
      merged[field] = sumCountingValues(field, cur, inc);
    } else if (cur !== inc) {
      merged[field] = inc;
    }
  }

  for (const field of BATTING_RATE_FIELDS) {
    const inc = incoming[field];
    if (inc == null) continue;
    if (!isNewUpload) {
      merged[field] = inc;
      continue;
    }
    if (hasSeasonBattingRates(incoming) && !hasSeasonBattingRates(existing)) {
      merged[field] = inc;
    } else if (hasSeasonBattingRates(existing) && hasSeasonBattingRates(incoming)) {
      merged[field] = inc;
    }
  }

  if (
    isNewUpload &&
    shouldSumBattingField("hits", existing, incoming, true)
  ) {
    merged.avg = null;
    merged.obp = null;
    merged.ops = null;
  }

  return merged;
}

export function mergePitchingRowsAccumulating(
  existing: PitchingRow,
  incoming: PitchingRow,
  isNewUpload: boolean
): PitchingRow {
  const merged = { ...existing };

  for (const field of PITCHING_COUNTING_FIELDS) {
    const inc = incoming[field];
    if (inc == null) continue;
    const cur = merged[field];
    if (cur == null) {
      merged[field] = inc;
      continue;
    }
    if (shouldSumPitchingField(field, existing, incoming, isNewUpload)) {
      merged[field] = sumCountingValues(field, cur, inc);
    } else if (cur !== inc) {
      merged[field] = inc;
    }
  }

  const incomingPitches = incoming.total_pitches ?? incoming.pitches;
  const currentPitches = merged.total_pitches ?? merged.pitches;
  if (incomingPitches != null) {
    if (currentPitches == null) {
      merged.total_pitches = incomingPitches;
      merged.pitches = incomingPitches;
    } else if (
      shouldSumPitchingField("innings_pitched", existing, incoming, isNewUpload)
    ) {
      const total = currentPitches + incomingPitches;
      merged.total_pitches = total;
      merged.pitches = total;
    } else if (currentPitches !== incomingPitches) {
      merged.total_pitches = incomingPitches;
      merged.pitches = incomingPitches;
    }
  }

  if (merged.total_pitches != null) {
    merged.pitches = merged.total_pitches;
  } else if (merged.pitches != null) {
    merged.total_pitches = merged.pitches;
  }

  if (
    isNewUpload &&
    shouldSumPitchingField("innings_pitched", existing, incoming, true)
  ) {
    for (const field of PITCHING_RATE_FIELDS) {
      if (hasSeasonPitchingRates(incoming) && incoming[field] != null) {
        merged[field] = incoming[field];
      } else if (!hasSeasonPitchingRates(incoming)) {
        merged[field] = null;
      }
    }
  }

  return recalculatePitchingRates(merged);
}
