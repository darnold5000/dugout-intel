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

function rowsMatchPitcher(
  a: { player_name: string | null; jersey_number?: string | null },
  b: { player_name: string | null; jersey_number?: string | null }
): boolean {
  const pa = parsePlayerIdentity(a.player_name, a.jersey_number ?? null);
  const pb = parsePlayerIdentity(b.player_name, b.jersey_number ?? null);
  if (pa.jersey_number && pb.jersey_number && pa.jersey_number === pb.jersey_number) {
    return true;
  }
  const na = pa.player_name?.toLowerCase().replace(/\./g, "").trim();
  const nb = pb.player_name?.toLowerCase().replace(/\./g, "").trim();
  if (na && nb && na === nb) return true;
  if (na && nb) {
    const partsA = na.split(/\s+/).filter(Boolean);
    const partsB = nb.split(/\s+/).filter(Boolean);
    const lastA = partsA[partsA.length - 1];
    const lastB = partsB[partsB.length - 1];
    if (
      lastA &&
      lastB &&
      lastA === lastB &&
      partsA[0]?.[0] &&
      partsB[0]?.[0] &&
      partsA[0][0] === partsB[0][0]
    ) {
      return true;
    }
  }
  return false;
}

const PITCH_STRIKE_PAIR =
  /(\d{1,3})\s*-\s*(\d{1,3})\s+((?:#\s*\d{1,3}\s+)?[A-Za-z][A-Za-z.'\s-]+?)(?=\s*(?:,|$|\d{1,3}\s*-\s*\d{1,3}))|((?:#\s*\d{1,3}\s+)?[A-Za-z][A-Za-z.'\s-]+?)\s+(\d{1,3})\s*-\s*(\d{1,3})(?=\s*(?:,|$|\d{1,3}\s*-\s*\d{1,3}))/gi;

function pushPitchStrikesEntry(
  entries: PitchStrikesEntry[],
  pitches: number,
  strikes: number,
  rawName: string
): void {
  if (!rawName || isExcludedPlayerRow(rawName)) return;
  const identity = parsePlayerIdentity(rawName, null);
  if (!identity.player_name) return;
  entries.push({
    player_name: identity.player_name,
    jersey_number: identity.jersey_number,
    total_pitches: pitches,
    strikes,
  });
}

/** Parse "39-24 Waylon W" or "Waylon W 39-24" segments from footer text. */
function parsePitchesStrikesSegments(text: string): PitchStrikesEntry[] {
  const entries: PitchStrikesEntry[] = [];

  let match: RegExpExecArray | null;
  PITCH_STRIKE_PAIR.lastIndex = 0;
  while ((match = PITCH_STRIKE_PAIR.exec(text)) !== null) {
    const pitches = Number(match[1] ?? match[6]);
    const strikes = Number(match[2] ?? match[7]);
    const rawName = (match[3] ?? match[5])?.trim();
    if (!rawName) continue;
    pushPitchStrikesEntry(entries, pitches, strikes, rawName);
  }

  if (entries.length > 0) return entries;

  // Fallback: split on commas after stripping label
  const cleaned = text
    .replace(/^pitches[\s-]*strikes\s*:?\s*/i, "")
    .trim();
  for (const part of cleaned.split(/,\s*/)) {
    const m = part.match(
      /^(\d{1,3})\s*-\s*(\d{1,3})\s+(.+)$|^(.+?)\s+(\d{1,3})\s*-\s*(\d{1,3})$/
    );
    if (!m) continue;
    const pitches = Number(m[1] ?? m[5]);
    const strikes = Number(m[2] ?? m[6]);
    const rawName = (m[3] ?? m[4])?.trim();
    if (!rawName) continue;
    pushPitchStrikesEntry(entries, pitches, strikes, rawName);
  }

  return entries;
}

function lineHasPitchStrikesPair(text: string): boolean {
  return /\d{1,3}\s*-\s*\d{1,3}/.test(text);
}

function isPitchStrikesHeader(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /pitches[\s-]*strikes/i.test(lower) ||
    (lower.includes("pitches") && lower.includes("strike"))
  );
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

function collectFooterLines(table: RawExtractedTable): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  const add = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    lines.push(trimmed);
  };

  if (table.headers.length) {
    add(table.headers.join(" "));
    for (const cell of table.headers) add(cell);
  }
  for (const row of table.rows) {
    add(row.filter(Boolean).join(" "));
    for (const cell of row) {
      if (cell?.trim()) add(cell);
    }
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

  let inPitchStrikesSection = false;

  for (const line of collectFooterLines(table)) {
    const lower = line.toLowerCase();

    if (isPitchStrikesHeader(line)) {
      const inline = parsePitchesStrikesSegments(line);
      if (inline.length) {
        pitchesStrikes.push(...inline);
        inPitchStrikesSection = false;
      } else {
        inPitchStrikesSection = true;
      }
      continue;
    }

    if (lower.includes("batters faced") || lower.startsWith("bf ")) {
      inPitchStrikesSection = false;
      battersFaced.push(...parseBattersFacedSegments(line));
      continue;
    }

    if (inPitchStrikesSection || lineHasPitchStrikesPair(line)) {
      const parsed = parsePitchesStrikesSegments(line);
      if (parsed.length) {
        pitchesStrikes.push(...parsed);
        if (!inPitchStrikesSection) continue;
      }
    }

    if (inPitchStrikesSection && !lineHasPitchStrikesPair(line)) {
      inPitchStrikesSection = false;
    }
  }

  return {
    pitchesStrikes: dedupePitchStrikes(pitchesStrikes),
    battersFaced,
  };
}

function dedupePitchStrikes(entries: PitchStrikesEntry[]): PitchStrikesEntry[] {
  const seen = new Map<string, PitchStrikesEntry>();
  for (const entry of entries) {
    const key = `${entry.jersey_number ?? ""}|${entry.player_name?.toLowerCase() ?? ""}|${entry.total_pitches}|${entry.strikes}`;
    seen.set(key, entry);
  }
  return Array.from(seen.values());
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
        earned_runs: null,
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
        earned_runs: null,
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
