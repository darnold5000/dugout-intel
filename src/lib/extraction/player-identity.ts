const EXCLUDED_NAMES = new Set([
  "TEAM",
  "TOTAL",
  "TOTALS",
  "OPPONENT",
  "OPPONENTS",
]);

export interface ParsedPlayerIdentity {
  player_name: string | null;
  jersey_number: string | null;
  merge_key: string | null;
  /** True when name still contains an unparsed comma-number pattern */
  unparsed_jersey_pattern: boolean;
}

export interface MergeDiagnostic {
  raw_name: string | null;
  raw_jersey: string | null;
  parsed_name: string | null;
  parsed_jersey: string | null;
  merge_key: string | null;
  consolidation_key: string | null;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHash(value: string): string {
  return value.replace(/^#+/, "").trim();
}

/** Extract jersey number embedded in a player name string. */
function extractJerseyFromName(name: string): {
  cleanName: string;
  jersey: string | null;
  unparsed: boolean;
} {
  const cleanName = normalizeSpaces(name.replace(/,/g, " ").trim());

  const patterns: RegExp[] = [
    /^#\s*(\d{1,3})\s+(.+)$/i,
    /^(.+?)\s*\(\s*#?\s*(\d{1,3})\s*\)\s*$/,
    /^(.+?)\s*#\s*(\d{1,3})\s*$/,
    /^(.+?)\s+(\d{1,2})$/,
  ];

  for (const pattern of patterns) {
    const match = cleanName.match(pattern);
    if (!match) continue;
    const [, first, second] = match;
    if (pattern.source.startsWith("^#")) {
      return { cleanName: normalizeSpaces(second), jersey: stripHash(first), unparsed: false };
    }
    return { cleanName: normalizeSpaces(first), jersey: stripHash(second), unparsed: false };
  }

  const unparsed = /,\s*#?\d/.test(name);

  return { cleanName: normalizeSpaces(name.replace(/,/g, "").trim()), jersey: null, unparsed };
}

export function parsePlayerIdentity(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined
): ParsedPlayerIdentity {
  let name = playerName?.trim() ? normalizeSpaces(playerName.trim()) : null;
  let jersey = jerseyNumber?.trim() ? stripHash(jerseyNumber.trim()) : null;
  let unparsed_jersey_pattern = false;

  if (name) {
    name = name.replace(/\./g, "").replace(/\s+/g, " ").trim();
    const extracted = extractJerseyFromName(name);
    name = extracted.cleanName || name;
    if (!jersey && extracted.jersey) jersey = extracted.jersey;
    unparsed_jersey_pattern = extracted.unparsed;
  }

  if (!name && !jersey) {
    return {
      player_name: null,
      jersey_number: null,
      merge_key: null,
      unparsed_jersey_pattern: false,
    };
  }

  if (name && EXCLUDED_NAMES.has(name.toUpperCase())) {
    return {
      player_name: name,
      jersey_number: jersey,
      merge_key: null,
      unparsed_jersey_pattern: false,
    };
  }

  const normalizedName = name ? name.toLowerCase().trim() : null;

  let merge_key: string | null = null;
  if (normalizedName && jersey) {
    merge_key = `${normalizedName}|${jersey}`;
  } else if (normalizedName) {
    merge_key = normalizedName;
  } else if (jersey) {
    merge_key = `|${jersey}`;
  }

  return {
    player_name: name,
    jersey_number: jersey,
    merge_key,
    unparsed_jersey_pattern,
  };
}

/** Full merge key with jersey when available (for diagnostics). */
export function getPlayerMergeKey(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined
): string | null {
  return parsePlayerIdentity(playerName, jerseyNumber).merge_key;
}

/** Preferred merge key: normalized name + jersey when available, else name only. */
export function normalizePlayerIdentity(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined
): string | null {
  return getPlayerMergeKey(playerName, jerseyNumber);
}

/**
 * Consolidation key groups rows that share the same player regardless of
 * whether jersey was captured in every screenshot.
 */
export function getConsolidationKey(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined
): string | null {
  const parsed = parsePlayerIdentity(playerName, jerseyNumber);
  if (!parsed.player_name && parsed.jersey_number) {
    return `jersey:${parsed.jersey_number}`;
  }
  if (!parsed.player_name || parsed.merge_key === null) return null;
  return parsed.player_name.toLowerCase().trim();
}

export function isExcludedPlayerRow(
  playerName: string | null | undefined
): boolean {
  if (!playerName?.trim()) return true;
  return EXCLUDED_NAMES.has(playerName.trim().toUpperCase());
}

export function buildMergeDiagnostic(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined
): MergeDiagnostic {
  const parsed = parsePlayerIdentity(playerName, jerseyNumber);
  return {
    raw_name: playerName ?? null,
    raw_jersey: jerseyNumber ?? null,
    parsed_name: parsed.player_name,
    parsed_jersey: parsed.jersey_number,
    merge_key: parsed.merge_key,
    consolidation_key: getConsolidationKey(playerName, jerseyNumber),
  };
}

export interface PotentialDuplicate {
  players: Array<{ name: string | null; jersey: string | null; key: string }>;
  reason: string;
}

/** Detect rows that may be the same player but have different consolidation keys. */
export function findPotentialDuplicates(
  entries: Array<{ name: string | null; jersey: string | null }>
): PotentialDuplicate[] {
  const byFirstToken = new Map<string, typeof entries>();

  for (const entry of entries) {
    const parsed = parsePlayerIdentity(entry.name, entry.jersey);
    if (!parsed.player_name) continue;
    const token = parsed.player_name.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!token) continue;
    const group = byFirstToken.get(token) ?? [];
    group.push(entry);
    byFirstToken.set(token, group);
  }

  const duplicates: PotentialDuplicate[] = [];

  for (const group of byFirstToken.values()) {
    if (group.length < 2) continue;
    const keys = new Set(
      group.map((e) => getConsolidationKey(e.name, e.jersey)).filter(Boolean)
    );
    if (keys.size <= 1) continue;

    duplicates.push({
      players: group.map((e) => ({
        name: parsePlayerIdentity(e.name, e.jersey).player_name,
        jersey: parsePlayerIdentity(e.name, e.jersey).jersey_number,
        key: getConsolidationKey(e.name, e.jersey) ?? "",
      })),
      reason: "Similar names with different merge keys — jersey may be missing from one row",
    });
  }

  return duplicates;
}
