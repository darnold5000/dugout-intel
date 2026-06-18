import type {
  AIExtractionResult,
  RawExtractedTable,
  ScreenshotType,
} from "@/types";
import { parsePlayerIdentity } from "@/lib/extraction/player-identity";

type BattingRow = AIExtractionResult["batting_stats"][number];
type PitchingRow = AIExtractionResult["pitching_stats"][number];

function normalizeHeader(header: string): string {
  return header.trim().toUpperCase().replace(/\s+/g, "").replace(/%/g, "%");
}

function parseDecimal(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;
  const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | null | undefined): number | null {
  const parsed = parseDecimal(value);
  return parsed == null ? null : Math.round(parsed);
}

function parsePercent(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/%$/, "");
  const parsed = parseDecimal(trimmed);
  if (parsed == null) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function isNameHeader(header: string): boolean {
  const h = normalizeHeader(header);
  return (
    h === "PLAYER" ||
    h === "NAME" ||
    h === "PLAYERNAME" ||
    h.includes("PLAYER") ||
    h === "#" ||
    h === "NO" ||
    h === "NUM" ||
    h === "NUMBER"
  );
}

function isNumericColumn(values: string[]): boolean {
  const sample = values.filter(Boolean).slice(0, 8);
  if (sample.length === 0) return false;
  return sample.some((v) => /^-?\d/.test(v.trim()) || /^\.\d/.test(v.trim()));
}

const BATTING_HEADERS: Record<string, keyof BattingRow> = {
  AVG: "avg",
  OBP: "obp",
  OPS: "ops",
  H: "hits",
  R: "runs",
  RBI: "rbi",
  BB: "walks",
  SO: "strikeouts",
  K: "strikeouts",
  SB: "stolen_bases",
};

const PITCHING_HEADERS: Record<string, keyof PitchingRow> = {
  IP: "innings_pitched",
  P: "pitches",
  S: "pitches",
  "S%": "strike_percentage",
  SPCT: "strike_percentage",
  FPS: "first_pitch_strike_pct",
  "FPS%": "first_pitch_strike_pct",
  ERA: "era",
  BB: "walks",
  SO: "strikeouts",
  K: "strikeouts",
  H: "hits_allowed",
  R: "runs_allowed",
  ER: "runs_allowed",
  BF: "batters_faced",
  WHIP: "whip",
  BAA: "batting_avg_against",
};

function scoreHeaders(headers: string[], map: Record<string, string>): number {
  const normalized = headers.map(normalizeHeader);
  return Object.keys(map).filter((key) => normalized.includes(key)).length;
}

function inferTableKind(headers: string[]): "batting" | "pitching" | "unknown" {
  const battingScore = scoreHeaders(headers, BATTING_HEADERS);
  const pitchingScore = scoreHeaders(headers, PITCHING_HEADERS);
  if (battingScore >= 2 && battingScore >= pitchingScore) return "batting";
  if (pitchingScore >= 2) return "pitching";
  return "unknown";
}

function findNameColumnIndex(headers: string[]): number {
  const byHeader = headers.findIndex((h) => isNameHeader(h));
  if (byHeader >= 0) return byHeader;
  return 0;
}

function mapTableToBattingStats(table: RawExtractedTable): BattingRow[] {
  if (!table.headers.length || !table.rows.length) return [];

  const normalizedHeaders = table.headers.map(normalizeHeader);
  const nameIdx = findNameColumnIndex(table.headers);
  const stats: BattingRow[] = [];

  for (const row of table.rows) {
    if (!row.some((cell) => cell?.trim())) continue;

    const stat: BattingRow = {
      player_name: row[nameIdx]?.trim() || null,
      jersey_number: null,
      avg: null,
      obp: null,
      ops: null,
      hits: null,
      walks: null,
      strikeouts: null,
      rbi: null,
      runs: null,
      stolen_bases: null,
      confidence: 0.85,
    };

    let filled = 0;
    normalizedHeaders.forEach((header, idx) => {
      const field = BATTING_HEADERS[header];
      if (!field || idx === nameIdx) return;
      const raw = row[idx]?.trim() ?? "";
      if (!raw) return;

      switch (field) {
        case "avg":
          stat.avg = parseDecimal(raw);
          break;
        case "obp":
          stat.obp = parseDecimal(raw);
          break;
        case "ops":
          stat.ops = parseDecimal(raw);
          break;
        case "hits":
          stat.hits = parseInteger(raw);
          break;
        case "runs":
          stat.runs = parseInteger(raw);
          break;
        case "rbi":
          stat.rbi = parseInteger(raw);
          break;
        case "walks":
          stat.walks = parseInteger(raw);
          break;
        case "strikeouts":
          stat.strikeouts = parseInteger(raw);
          break;
        case "stolen_bases":
          stat.stolen_bases = parseInteger(raw);
          break;
      }
      filled += 1;
    });

    if (stat.player_name && filled > 0) {
      stats.push(stat);
    }
  }

  return stats;
}

function mapTableToPitchingStats(table: RawExtractedTable): PitchingRow[] {
  if (!table.headers.length || !table.rows.length) return [];

  const normalizedHeaders = table.headers.map(normalizeHeader);
  const nameIdx = findNameColumnIndex(table.headers);
  const stats: PitchingRow[] = [];

  for (const row of table.rows) {
    if (!row.some((cell) => cell?.trim())) continue;

    const stat: PitchingRow = {
      player_name: row[nameIdx]?.trim() || null,
      jersey_number: null,
      innings_pitched: null,
      pitches: null,
      strike_percentage: null,
      first_pitch_strike_pct: null,
      era: null,
      walks: null,
      strikeouts: null,
      hits_allowed: null,
      runs_allowed: null,
      batters_faced: null,
      whip: null,
      batting_avg_against: null,
      confidence: 0.85,
    };

    let filled = 0;
    normalizedHeaders.forEach((header, idx) => {
      const field = PITCHING_HEADERS[header];
      if (!field || idx === nameIdx) return;
      const raw = row[idx]?.trim() ?? "";
      if (!raw) return;

      switch (field) {
        case "innings_pitched":
          stat.innings_pitched = parseDecimal(raw);
          break;
        case "pitches":
          stat.pitches = parseInteger(raw);
          break;
        case "strike_percentage":
          stat.strike_percentage = parsePercent(raw);
          break;
        case "era":
          stat.era = parseDecimal(raw);
          break;
        case "walks":
          stat.walks = parseInteger(raw);
          break;
        case "strikeouts":
          stat.strikeouts = parseInteger(raw);
          break;
        case "hits_allowed":
          stat.hits_allowed = parseInteger(raw);
          break;
        case "runs_allowed":
          stat.runs_allowed = parseInteger(raw);
          break;
        case "first_pitch_strike_pct":
          stat.first_pitch_strike_pct = parsePercent(raw);
          break;
        case "batters_faced":
          stat.batters_faced = parseInteger(raw);
          break;
        case "whip":
          stat.whip = parseDecimal(raw);
          break;
        case "batting_avg_against":
          stat.batting_avg_against = parseDecimal(raw);
          break;
      }
      filled += 1;
    });

    if (stat.player_name && filled > 0) {
      stats.push(stat);
    }
  }

  return stats;
}

function rowsMatchPlayer(
  a: { player_name: string | null; jersey_number?: string | null },
  b: { player_name: string | null; jersey_number?: string | null }
): boolean {
  const nameA = parsePlayerIdentity(a.player_name, a.jersey_number ?? null).player_name?.toLowerCase();
  const nameB = parsePlayerIdentity(b.player_name, b.jersey_number ?? null).player_name?.toLowerCase();
  return nameA === nameB && !!nameA;
}

function hasNumericStatValues(row: BattingRow | PitchingRow): boolean {
  return Object.entries(row).some(([key, value]) => {
    if (key === "player_name" || key === "jersey_number" || key === "confidence") {
      return false;
    }
    return value != null;
  });
}

function mergeBattingStats(
  primary: BattingRow[],
  secondary: BattingRow[]
): BattingRow[] {
  const merged = [...primary];

  for (const row of secondary) {
    const existing = merged.find((item) => rowsMatchPlayer(item, row));

    if (existing) {
      if (existing.avg == null && row.avg != null) existing.avg = row.avg;
      if (existing.obp == null && row.obp != null) existing.obp = row.obp;
      if (existing.ops == null && row.ops != null) existing.ops = row.ops;
      if (existing.hits == null && row.hits != null) existing.hits = row.hits;
      if (existing.runs == null && row.runs != null) existing.runs = row.runs;
      if (existing.rbi == null && row.rbi != null) existing.rbi = row.rbi;
      if (existing.walks == null && row.walks != null) existing.walks = row.walks;
      if (existing.strikeouts == null && row.strikeouts != null) {
        existing.strikeouts = row.strikeouts;
      }
      if (existing.stolen_bases == null && row.stolen_bases != null) {
        existing.stolen_bases = row.stolen_bases;
      }
      if (!hasNumericStatValues(existing) && hasNumericStatValues(row)) {
        Object.assign(existing, row);
      }
    } else if (hasNumericStatValues(row)) {
      merged.push(row);
    }
  }

  return merged;
}

function mergePitchingStats(
  primary: PitchingRow[],
  secondary: PitchingRow[]
): PitchingRow[] {
  const merged = [...primary];

  for (const row of secondary) {
    const existing = merged.find((item) => rowsMatchPlayer(item, row));

    if (existing) {
      if (existing.innings_pitched == null && row.innings_pitched != null) {
        existing.innings_pitched = row.innings_pitched;
      }
      if (existing.pitches == null && row.pitches != null) {
        existing.pitches = row.pitches;
      }
      if (existing.strike_percentage == null && row.strike_percentage != null) {
        existing.strike_percentage = row.strike_percentage;
      }
      if (existing.era == null && row.era != null) existing.era = row.era;
      if (existing.walks == null && row.walks != null) existing.walks = row.walks;
      if (existing.strikeouts == null && row.strikeouts != null) {
        existing.strikeouts = row.strikeouts;
      }
      if (existing.hits_allowed == null && row.hits_allowed != null) {
        existing.hits_allowed = row.hits_allowed;
      }
      if (existing.runs_allowed == null && row.runs_allowed != null) {
        existing.runs_allowed = row.runs_allowed;
      }
      if (!hasNumericStatValues(existing) && hasNumericStatValues(row)) {
        Object.assign(existing, row);
      }
    } else if (hasNumericStatValues(row)) {
      merged.push(row);
    }
  }

  return merged;
}

function tableHasNumericColumns(table: RawExtractedTable): boolean {
  if (!table.headers.length) return false;
  const nameIdx = findNameColumnIndex(table.headers);
  return table.headers.some((header, idx) => {
    if (idx === nameIdx || isNameHeader(header)) return false;
    const columnValues = table.rows.map((row) => row[idx] ?? "");
    return isNumericColumn(columnValues);
  });
}

function tableOnlyHasNames(table: RawExtractedTable): boolean {
  if (!table.rows.length) return false;
  const nameIdx = findNameColumnIndex(table.headers);
  return table.rows.every((row) => {
    const name = row[nameIdx]?.trim();
    const otherValues = row.filter((_, idx) => idx !== nameIdx).some((v) => v?.trim());
    return !!name && !otherValues;
  });
}

export function normalizeScreenshotType(type: string | null | undefined): ScreenshotType {
  switch (type) {
    case "roster":
    case "batting_stats":
    case "pitching_stats":
    case "schedule_results":
    case "box_score":
    case "unknown":
      return type;
    case "schedule":
    case "game_summary":
      return "schedule_results";
    default:
      return "unknown";
  }
}

export function enrichExtractionResult(
  extraction: AIExtractionResult
): AIExtractionResult {
  const table = extraction.raw_extracted_table;
  const warnings = [...(extraction.warnings ?? [])];

  if (!table?.headers?.length) {
    warnings.push("Table headers missing — stat columns may not have been captured.");
  } else if (table.headers.length > 0 && table.rows.length === 0) {
    warnings.push("Column headers detected but no player rows were extracted.");
  }

  if (table && tableOnlyHasNames(table)) {
    warnings.push("Only player names appear readable — stat columns may be cropped, blurry, or too small.");
  }

  if (table && !tableHasNumericColumns(table)) {
    warnings.push("No numeric stat columns detected in raw_extracted_table.");
  }

  let battingStats = [...extraction.batting_stats];
  let pitchingStats = [...extraction.pitching_stats];
  let screenshotType = normalizeScreenshotType(extraction.screenshot_type);

  if (table?.headers?.length && table.rows?.length) {
    const tableKind = inferTableKind(table.headers);

    if (tableKind === "batting") {
      const mapped = mapTableToBattingStats(table);
      if (mapped.length > 0) {
        battingStats = mergeBattingStats(battingStats, mapped);
        if (screenshotType === "unknown") screenshotType = "batting_stats";
      }
    } else if (tableKind === "pitching") {
      const mapped = mapTableToPitchingStats(table);
      if (mapped.length > 0) {
        pitchingStats = mergePitchingStats(pitchingStats, mapped);
        if (screenshotType === "unknown") screenshotType = "pitching_stats";
      }
    } else if (tableHasNumericColumns(table)) {
      const battingMapped = mapTableToBattingStats(table);
      const pitchingMapped = mapTableToPitchingStats(table);
      const battingScore = battingMapped.filter(hasNumericStatValues).length;
      const pitchingScore = pitchingMapped.filter(hasNumericStatValues).length;

      if (battingScore >= pitchingScore && battingScore > 0) {
        battingStats = mergeBattingStats(battingStats, battingMapped);
        if (screenshotType === "unknown") screenshotType = "batting_stats";
      } else if (pitchingScore > 0) {
        pitchingStats = mergePitchingStats(pitchingStats, pitchingMapped);
        if (screenshotType === "unknown") screenshotType = "pitching_stats";
      }
    }
  }

  const battingWithoutStats = battingStats.filter((row) => !hasNumericStatValues(row));
  if (battingWithoutStats.length > 0 && battingStats.length > 0) {
    warnings.push(
      `${battingWithoutStats.length} batting row(s) contain names but no readable stat values.`
    );
  }

  return {
    ...extraction,
    screenshot_type: screenshotType,
    batting_stats: battingStats,
    pitching_stats: pitchingStats,
    warnings: [...new Set(warnings)],
  };
}
