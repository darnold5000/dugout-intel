import {
  isExcludedPlayerRow,
  parsePlayerIdentity,
} from "@/lib/extraction/player-identity";
import type { AIExtractionResult, RawExtractedTable } from "@/types";

type PitchingRow = AIExtractionResult["pitching_stats"][number];

interface PitchStrikesEntry {
  player_name: string;
  jersey_number: string | null;
  total_pitches: number;
  strikes: number;
}

interface BattersFacedEntry {
  player_name: string;
  jersey_number: string | null;
  batters_faced: number;
}

function normalizeNameKey(name: string): string {
  return parsePlayerIdentity(name, null).player_name?.toLowerCase() ?? "";
}

function rowsMatchPitcher(
  a: { player_name: string | null; jersey_number?: string | null },
  b: { player_name: string | null; jersey_number?: string | null }
): boolean {
  const pa = parsePlayerIdentity(a.player_name, a.jersey_number ?? null);
  const pb = parsePlayerIdentity(b.player_name, b.jersey_number ?? null);
  if (pa.jersey_number && pb.jersey_number && pa.jersey_number === pb.jersey_number) {
    return true;
  }
  const na = pa.player_name?.toLowerCase();
  const nb = pb.player_name?.toLowerCase();
  return !!na && !!nb && na === nb;
}

/** Parse "39-24 Waylon W" or "Waylon W 39-24" segments from footer text. */
function parsePitchesStrikesSegments(text: string): PitchStrikesEntry[] {
  const entries: PitchStrikesEntry[] = [];
  const segmentPattern =
    /(?:(\d{1,3})-(\d{1,3})\s+([A-Za-z][A-Za-z.'\s-]+?)|([A-Za-z][A-Za-z.'\s-]+?)\s+(\d{1,3})-(\d{1,3}))(?=\s*(?:,|$|\d{1,3}-))/gi;

  let match: RegExpExecArray | null;
  while ((match = segmentPattern.exec(text)) !== null) {
    const pitches = Number(match[1] ?? match[5]);
    const strikes = Number(match[2] ?? match[6]);
    const rawName = (match[3] ?? match[4])?.trim();
    if (!rawName || isExcludedPlayerRow(rawName)) continue;
    const identity = parsePlayerIdentity(rawName, null);
    if (!identity.player_name) continue;
    entries.push({
      player_name: identity.player_name,
      jersey_number: identity.jersey_number,
      total_pitches: pitches,
      strikes,
    });
  }

  if (entries.length > 0) return entries;

  // Fallback: split on commas after stripping label
  const cleaned = text
    .replace(/^pitches[\s-]*strikes\s*:?\s*/i, "")
    .trim();
  for (const part of cleaned.split(/,\s*/)) {
    const m = part.match(
      /^(\d{1,3})-(\d{1,3})\s+(.+)$|^(.+?)\s+(\d{1,3})-(\d{1,3})$/
    );
    if (!m) continue;
    const pitches = Number(m[1] ?? m[5]);
    const strikes = Number(m[2] ?? m[6]);
    const rawName = (m[3] ?? m[4])?.trim();
    if (!rawName || isExcludedPlayerRow(rawName)) continue;
    const identity = parsePlayerIdentity(rawName, null);
    if (!identity.player_name) continue;
    entries.push({
      player_name: identity.player_name,
      jersey_number: identity.jersey_number,
      total_pitches: pitches,
      strikes,
    });
  }

  return entries;
}

/** Parse "10 Waylon W" segments from Batters Faced footer text. */
function parseBattersFacedSegments(text: string): BattersFacedEntry[] {
  const entries: BattersFacedEntry[] = [];
  const cleaned = text.replace(/^batters\s+faced\s*:?\s*/i, "").trim();

  for (const part of cleaned.split(/,\s*/)) {
    const m = part.match(/^(\d{1,3})\s+(.+)$|^(.+?)\s+(\d{1,3})$/);
    if (!m) continue;
    const bf = Number(m[1] ?? m[4]);
    const rawName = (m[2] ?? m[3])?.trim();
    if (!rawName || isExcludedPlayerRow(rawName)) continue;
    const identity = parsePlayerIdentity(rawName, null);
    if (!identity.player_name) continue;
    entries.push({
      player_name: identity.player_name,
      jersey_number: identity.jersey_number,
      batters_faced: bf,
    });
  }

  return entries;
}

function collectTableText(table: RawExtractedTable): string[] {
  const lines: string[] = [];
  if (table.headers.length) {
    lines.push(table.headers.join(" "));
  }
  for (const row of table.rows) {
    const line = row.filter(Boolean).join(" ").trim();
    if (line) lines.push(line);
  }
  return lines;
}

export function parseBoxScorePitchingFooter(
  table: RawExtractedTable | null | undefined
): {
  pitchesStrikes: PitchStrikesEntry[];
  battersFaced: BattersFacedEntry[];
} {
  const pitchesStrikes: PitchStrikesEntry[] = [];
  const battersFaced: BattersFacedEntry[] = [];
  if (!table) return { pitchesStrikes, battersFaced };

  for (const line of collectTableText(table)) {
    const lower = line.toLowerCase();
    if (lower.includes("pitches") && lower.includes("strike")) {
      pitchesStrikes.push(...parsePitchesStrikesSegments(line));
    } else if (lower.includes("batters faced") || lower.startsWith("bf ")) {
      battersFaced.push(...parseBattersFacedSegments(line));
    }
  }

  return { pitchesStrikes, battersFaced };
}

export function applyBoxScorePitchingSupplements(
  pitchingStats: PitchingRow[],
  table: RawExtractedTable | null | undefined
): PitchingRow[] {
  const { pitchesStrikes, battersFaced } = parseBoxScorePitchingFooter(table);
  if (!pitchesStrikes.length && !battersFaced.length) {
    return pitchingStats;
  }

  const merged = pitchingStats.map((row) => ({ ...row }));

  for (const entry of pitchesStrikes) {
    let target = merged.find((row) => rowsMatchPitcher(row, entry));
    if (!target) {
      target = {
        player_name: entry.player_name,
        jersey_number: entry.jersey_number,
        innings_pitched: null,
        pitches: entry.total_pitches,
        total_pitches: entry.total_pitches,
        batters_faced: null,
        strikes: entry.strikes,
        strike_percentage:
          entry.total_pitches > 0
            ? (entry.strikes / entry.total_pitches) * 100
            : null,
        first_pitch_strike_pct: null,
        era: null,
        walks: null,
        strikeouts: null,
        hits_allowed: null,
        runs_allowed: null,
        k_bb_ratio: null,
        walks_per_inning: null,
        pitches_per_inning: null,
        pitches_per_batter_faced: null,
        one_two_three_innings: null,
        leadoff_outs: null,
        swing_miss_pct: null,
        baa: null,
        babip: null,
        fip: null,
        confidence: 0.8,
      };
      merged.push(target);
      continue;
    }
    if (target.total_pitches == null) {
      target.total_pitches = entry.total_pitches;
      target.pitches = entry.total_pitches;
    }
    if (target.strikes == null) target.strikes = entry.strikes;
    if (target.strike_percentage == null && entry.total_pitches > 0) {
      target.strike_percentage = (entry.strikes / entry.total_pitches) * 100;
    }
    if (!target.jersey_number && entry.jersey_number) {
      target.jersey_number = entry.jersey_number;
    }
  }

  for (const entry of battersFaced) {
    const target = merged.find((row) => rowsMatchPitcher(row, entry));
    if (target) {
      if (target.batters_faced == null) target.batters_faced = entry.batters_faced;
      if (!target.jersey_number && entry.jersey_number) {
        target.jersey_number = entry.jersey_number;
      }
    } else {
      merged.push({
        player_name: entry.player_name,
        jersey_number: entry.jersey_number,
        innings_pitched: null,
        pitches: null,
        total_pitches: null,
        batters_faced: entry.batters_faced,
        strikes: null,
        strike_percentage: null,
        first_pitch_strike_pct: null,
        era: null,
        walks: null,
        strikeouts: null,
        hits_allowed: null,
        runs_allowed: null,
        k_bb_ratio: null,
        walks_per_inning: null,
        pitches_per_inning: null,
        pitches_per_batter_faced: null,
        one_two_three_innings: null,
        leadoff_outs: null,
        swing_miss_pct: null,
        baa: null,
        babip: null,
        fip: null,
        confidence: 0.8,
      });
    }
  }

  return merged;
}
