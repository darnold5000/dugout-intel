import { parseBaseballInnings } from "@/lib/scouting/innings";
import type { ExtractedPitchingStat } from "@/types";

type PitchingLike = Pick<
  ExtractedPitchingStat,
  | "innings_pitched"
  | "walks"
  | "hits_allowed"
  | "strikeouts"
  | "batters_faced"
  | "total_pitches"
  | "pitches"
  | "strikes"
  | "strike_percentage"
  | "pitches_per_inning"
  | "pitches_per_batter_faced"
>;

/** Box score estimate: BF ≈ 3 outs per IP + walks + hits allowed. */
export function deriveBattersFaced(stat: PitchingLike): number | null {
  if (stat.batters_faced != null) return stat.batters_faced;
  if (stat.innings_pitched == null) return null;
  if (
    stat.walks == null &&
    stat.hits_allowed == null &&
    stat.strikeouts == null
  ) {
    return null;
  }
  const ip = parseBaseballInnings(stat.innings_pitched);
  return Math.round(3 * ip + (stat.walks ?? 0) + (stat.hits_allowed ?? 0));
}

export function enrichPitchingStatForDisplay<T extends PitchingLike>(stat: T): T {
  let next = { ...stat };
  const bf = deriveBattersFaced(next);
  if (bf != null && next.batters_faced == null) {
    next = { ...next, batters_faced: bf };
  }

  const ip =
    next.innings_pitched != null
      ? parseBaseballInnings(next.innings_pitched)
      : null;

  if (next.total_pitches == null && next.pitches_per_inning != null && ip != null) {
    const pitches = Math.round(next.pitches_per_inning * ip);
    next = { ...next, total_pitches: pitches, pitches };
  } else if (
    next.total_pitches == null &&
    next.pitches_per_batter_faced != null &&
    next.batters_faced != null
  ) {
    const pitches = Math.round(next.pitches_per_batter_faced * next.batters_faced);
    next = { ...next, total_pitches: pitches, pitches };
  }

  if (
    next.strikes == null &&
    next.total_pitches != null &&
    next.strike_percentage != null
  ) {
    const pct =
      next.strike_percentage > 1
        ? next.strike_percentage / 100
        : next.strike_percentage;
    next = { ...next, strikes: Math.round(next.total_pitches * pct) };
  }

  return next;
}

/** Fill missing pitching count fields when box score / advanced columns allow it. */
export function enrichPitchingStatRow<T extends PitchingLike>(stat: T): T {
  return enrichPitchingStatForDisplay(stat);
}
