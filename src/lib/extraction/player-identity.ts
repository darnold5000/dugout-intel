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

/** Normalize display name: strip periods, collapse spaces, lowercase for matching. */
export function normalizePlayerName(name: string): string {
  return normalizeSpaces(name.replace(/\./g, "")).toLowerCase();
}

function stripPositionAnnotations(name: string): string {
  return normalizeSpaces(
    name.replace(
      /\s*\(\s*(?:3B|1B|2B|SS|OF|IF|P|C|LHP|RHP|DH|CF|RF|LF|UTIL)(?:\s*[/,]\s*(?:3B|1B|2B|SS|OF|IF|P|C|LHP|RHP|DH|CF|RF|LF|UTIL))*\s*\)\s*/gi,
      " "
    )
  );
}

/** Extract jersey number embedded in a player name string. */
function extractJerseyFromName(name: string): {
  cleanName: string;
  jersey: string | null;
  unparsed: boolean;
} {
  let working = stripPositionAnnotations(
    normalizeSpaces(name.replace(/,/g, " ").trim())
  );

  const inlineJersey = working.match(/#\s*(\d{1,3})/);
  if (inlineJersey) {
    const jersey = stripHash(inlineJersey[1]);
    working = normalizeSpaces(
      working.replace(/#\s*\d{1,3}/, "").replace(/\s+/g, " ").trim()
    );
    if (working) {
      return { cleanName: working, jersey, unparsed: false };
    }
  }

  const patterns: RegExp[] = [
    /^#\s*(\d{1,3})\s+(.+)$/i,
    /^(.+?)\s*\(\s*#?\s*(\d{1,3})\s*\)\s*$/,
    /^(.+?)\s*#\s*(\d{1,3})\s*$/,
    /^(.+?)\s+(\d{1,3})$/,
    /^(.+?),\s*#?\s*(\d{1,3})\s*$/,
  ];

  for (const pattern of patterns) {
    const match = working.match(pattern);
    if (!match) continue;
    const [, first, second] = match;
    if (pattern.source.startsWith("^#")) {
      return {
        cleanName: normalizeSpaces(second),
        jersey: stripHash(first),
        unparsed: false,
      };
    }
    return {
      cleanName: normalizeSpaces(first),
      jersey: stripHash(second),
      unparsed: false,
    };
  }

  // Handle compact forms like "J Stewart#18" or "J Stewart,18"
  const compact = working.match(/^(.+?)[,#]\s*#?(\d{1,3})\s*$/);
  if (compact) {
    return {
      cleanName: normalizeSpaces(compact[1]),
      jersey: stripHash(compact[2]),
      unparsed: false,
    };
  }

  const unparsed = /,\s*#?\d/.test(name);

  // Last resort: strip any trailing #NN or , NN from the name
  const stripped = working
    .replace(/\s*#\s*\d{1,3}\s*$/, "")
    .replace(/\s+\d{1,3}\s*$/, "")
    .trim();

  return {
    cleanName: normalizeSpaces(stripped || working),
    jersey: null,
    unparsed,
  };
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

  const normalizedName = name ? normalizePlayerName(name) : null;

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
  return normalizePlayerName(parsed.player_name);
}

/**
 * Build a map from any raw consolidation key to a canonical key so that
 * "j stewart", "j stewart|18", and "jersey:18" all resolve to one player.
 */
export function buildCanonicalKeyMap(
  entries: Array<{ name: string | null; jersey: string | null }>
): Map<string, string> {
  const canonical = new Map<string, string>();
  const jerseyToName = new Map<string, string>();

  for (const entry of entries) {
    const parsed = parsePlayerIdentity(entry.name, entry.jersey);
    if (!parsed.player_name && !parsed.jersey_number) continue;

    const nameKey = parsed.player_name
      ? normalizePlayerName(parsed.player_name)
      : null;

    if (nameKey && parsed.jersey_number) {
      jerseyToName.set(parsed.jersey_number, nameKey);
    }

    if (nameKey) {
      canonical.set(nameKey, nameKey);
      if (parsed.jersey_number) {
        canonical.set(`${nameKey}|${parsed.jersey_number}`, nameKey);
      }
    }
    if (parsed.jersey_number) {
      canonical.set(`jersey:${parsed.jersey_number}`, nameKey ?? `jersey:${parsed.jersey_number}`);
    }
  }

  for (const [jersey, nameKey] of jerseyToName) {
    canonical.set(`jersey:${jersey}`, nameKey);
    canonical.set(`${nameKey}|${jersey}`, nameKey);
  }

  // Tier 1: jersey number wins — merge name variants sharing the same number
  const namesByJersey = new Map<string, Set<string>>();
  for (const entry of entries) {
    const parsed = parsePlayerIdentity(entry.name, entry.jersey);
    if (!parsed.jersey_number || !parsed.player_name) continue;
    const nameKey = normalizePlayerName(parsed.player_name);
    const group = namesByJersey.get(parsed.jersey_number) ?? new Set();
    group.add(nameKey);
    namesByJersey.set(parsed.jersey_number, group);
  }

  for (const [jersey, nameKeys] of namesByJersey) {
    const sorted = [...nameKeys].sort((a, b) => b.length - a.length);
    const winner = sorted[0];
    if (!winner) continue;
    canonical.set(`jersey:${jersey}`, winner);
    for (const nameKey of nameKeys) {
      canonical.set(nameKey, winner);
      canonical.set(`${nameKey}|${jersey}`, winner);
    }
  }

  return canonical;
}

export function resolveConsolidationKey(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined,
  canonicalMap?: Map<string, string>
): string | null {
  const parsed = parsePlayerIdentity(playerName, jerseyNumber);

  if (!parsed.player_name && parsed.jersey_number) {
    const rawKey = `jersey:${parsed.jersey_number}`;
    return canonicalMap?.get(rawKey) ?? rawKey;
  }

  if (!parsed.player_name) return null;

  const nameKey = normalizePlayerName(parsed.player_name);
  if (!canonicalMap) return nameKey;

  if (parsed.jersey_number) {
    const byJersey = canonicalMap.get(`jersey:${parsed.jersey_number}`);
    if (byJersey) return byJersey;
    const byMerge = canonicalMap.get(`${nameKey}|${parsed.jersey_number}`);
    if (byMerge) return byMerge;
  }

  return canonicalMap.get(nameKey) ?? nameKey;
}

export function isScoutablePlayerName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = name.trim();
  if (EXCLUDED_NAMES.has(n.toUpperCase())) return false;
  // Jersey numbers mis-parsed as player names (common in cropped GC tables)
  if (/^\d{1,3}$/.test(n)) return false;
  if (!/[a-zA-Z]/.test(n)) return false;
  return true;
}

export function isExcludedPlayerRow(
  playerName: string | null | undefined
): boolean {
  if (!playerName?.trim()) return true;
  const parsed = parsePlayerIdentity(playerName, null);
  if (!parsed.player_name) return true;
  if (!isScoutablePlayerName(parsed.player_name)) return true;
  return EXCLUDED_NAMES.has(parsed.player_name.toUpperCase());
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
  const canonicalMap = buildCanonicalKeyMap(entries);
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
      group
        .map((e) => resolveConsolidationKey(e.name, e.jersey, canonicalMap))
        .filter(Boolean)
    );
    if (keys.size <= 1) continue;

    duplicates.push({
      players: group.map((e) => ({
        name: parsePlayerIdentity(e.name, e.jersey).player_name,
        jersey: parsePlayerIdentity(e.name, e.jersey).jersey_number,
        key: resolveConsolidationKey(e.name, e.jersey, canonicalMap) ?? "",
      })),
      reason: "Similar names with different merge keys — jersey may be missing from one row",
    });
  }

  return duplicates;
}
