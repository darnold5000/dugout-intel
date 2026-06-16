const EXCLUDED_NAMES = new Set(["TEAM", "TOTAL", "TOTALS", "OPPONENT"]);

export interface ParsedPlayerIdentity {
  player_name: string | null;
  jersey_number: string | null;
  merge_key: string | null;
}

/** Strip embedded jersey numbers from names like "Dylan F, 18" or "Heath H, #8". */
export function parsePlayerIdentity(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined
): ParsedPlayerIdentity {
  let name = playerName?.trim() ?? null;
  let jersey = jerseyNumber?.trim() ?? null;

  if (!name) {
    return { player_name: null, jersey_number: jersey, merge_key: null };
  }

  const embedded = name.match(/^(.+?),\s*#?(\d+)\s*$/);
  if (embedded) {
    name = embedded[1].trim();
    if (!jersey) jersey = embedded[2];
  }

  const normalizedName = name.toLowerCase().trim();
  const upperName = name.toUpperCase().trim();

  if (EXCLUDED_NAMES.has(upperName)) {
    return { player_name: name, jersey_number: jersey, merge_key: null };
  }

  const merge_key = jersey
    ? `${normalizedName}|${jersey}`
    : normalizedName;

  return { player_name: name, jersey_number: jersey, merge_key };
}

/** Preferred merge key: normalized name + jersey when available, else name only. */
export function normalizePlayerIdentity(
  playerName: string | null | undefined,
  jerseyNumber: string | null | undefined
): string | null {
  return parsePlayerIdentity(playerName, jerseyNumber).merge_key;
}

export function isExcludedPlayerRow(
  playerName: string | null | undefined
): boolean {
  if (!playerName?.trim()) return true;
  return EXCLUDED_NAMES.has(playerName.trim().toUpperCase());
}
