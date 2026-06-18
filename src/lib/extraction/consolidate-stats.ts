import type { AIExtractionResult, RawExtractedTable } from "@/types";
import {
  buildCanonicalKeyMap,
  isExcludedPlayerRow,
  parsePlayerIdentity,
  resolveConsolidationKey,
} from "@/lib/extraction/player-identity";
import { enrichExtractionResult } from "@/lib/extraction/post-process";

type BattingRow = AIExtractionResult["batting_stats"][number];
type PitchingRow = AIExtractionResult["pitching_stats"][number];
type PlayerRow = AIExtractionResult["players"][number];
type GameRow = AIExtractionResult["games"][number];

export interface SourcedRow<T> {
  row: T;
  uploadId: string;
  order: number;
}

export interface ConsolidatedBattingRow extends BattingRow {
  source_upload_ids: string[];
}

export interface ConsolidatedPitchingRow extends PitchingRow {
  source_upload_ids: string[];
}

export interface ConsolidatedPlayerRow extends PlayerRow {
  source_upload_ids: string[];
}

export interface ConsolidatedGameRow extends GameRow {
  source_upload_ids: string[];
}

interface FieldMeta {
  confidence: number;
  order: number;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 0.0001;
  }
  return a === b;
}

function mergeField<T>(
  fieldLabel: string,
  playerLabel: string,
  current: { value: T | null; meta: FieldMeta },
  incoming: { value: T | null; meta: FieldMeta },
  warnings: string[]
): T | null {
  if (incoming.value == null) return current.value;
  if (current.value == null) return incoming.value;
  if (valuesEqual(current.value, incoming.value)) return current.value;

  const keepIncoming =
    incoming.meta.confidence > current.meta.confidence ||
    (incoming.meta.confidence === current.meta.confidence &&
      incoming.meta.order > current.meta.order);

  const kept = keepIncoming ? incoming.value : current.value;
  const dropped = keepIncoming ? current.value : incoming.value;

  warnings.push(
    `Stat conflict for ${playerLabel} ${fieldLabel}: kept ${kept}, dropped ${dropped}`
  );
  return kept;
}

function battingHasStats(row: BattingRow): boolean {
  return [
    row.avg,
    row.obp,
    row.ops,
    row.hits,
    row.walks,
    row.strikeouts,
    row.rbi,
    row.runs,
    row.stolen_bases,
  ].some((v) => v != null);
}

function pitchingHasStats(row: PitchingRow): boolean {
  return [
    row.innings_pitched,
    row.total_pitches,
    row.pitches,
    row.batters_faced,
    row.strikes,
    row.strike_percentage,
    row.first_pitch_strike_pct,
    row.era,
    row.walks,
    row.strikeouts,
    row.hits_allowed,
    row.runs_allowed,
    row.k_bb_ratio,
    row.walks_per_inning,
    row.pitches_per_inning,
    row.pitches_per_batter_faced,
    row.one_two_three_innings,
    row.leadoff_outs,
    row.swing_miss_pct,
    row.baa,
    row.babip,
    row.fip,
  ].some((v) => v != null);
}

const BATTING_FIELDS = [
  "avg",
  "obp",
  "ops",
  "hits",
  "walks",
  "strikeouts",
  "rbi",
  "runs",
  "stolen_bases",
] as const;

const PITCHING_FIELDS = [
  "innings_pitched",
  "pitches",
  "total_pitches",
  "batters_faced",
  "strikes",
  "strike_percentage",
  "first_pitch_strike_pct",
  "era",
  "walks",
  "strikeouts",
  "hits_allowed",
  "runs_allowed",
  "k_bb_ratio",
  "walks_per_inning",
  "pitches_per_inning",
  "pitches_per_batter_faced",
  "one_two_three_innings",
  "leadoff_outs",
  "swing_miss_pct",
  "baa",
  "babip",
  "fip",
] as const;

function collectIdentityEntries<T extends { player_name?: string | null; name?: string | null; jersey_number?: string | null }>(
  rows: SourcedRow<T>[]
): Array<{ name: string | null; jersey: string | null }> {
  return rows.map(({ row }) => ({
    name: row.player_name ?? row.name ?? null,
    jersey: row.jersey_number ?? null,
  }));
}

function consolidationKeyForRow<T extends { player_name?: string | null; name?: string | null; jersey_number?: string | null }>(
  row: T,
  canonicalMap: Map<string, string>
): string | null {
  const name = row.player_name ?? row.name ?? null;
  return resolveConsolidationKey(name, row.jersey_number, canonicalMap);
}

export function mergeBattingStatRows(
  rows: SourcedRow<BattingRow>[],
  warnings: string[] = []
): ConsolidatedBattingRow[] {
  const canonicalMap = buildCanonicalKeyMap(collectIdentityEntries(rows));
  const byKey = new Map<
    string,
    {
      identity: ReturnType<typeof parsePlayerIdentity>;
      row: BattingRow;
      source_upload_ids: Set<string>;
      fieldMeta: Partial<Record<(typeof BATTING_FIELDS)[number], FieldMeta>>;
    }
  >();

  for (const { row, uploadId, order } of rows) {
    if (isExcludedPlayerRow(row.player_name)) continue;
    if (!battingHasStats(row)) continue;

    const identity = parsePlayerIdentity(row.player_name, row.jersey_number);
    const key = consolidationKeyForRow(row, canonicalMap);
    if (!key) continue;

    const meta: FieldMeta = { confidence: row.confidence, order };
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        identity,
        row: {
          ...row,
          player_name: identity.player_name,
          jersey_number: identity.jersey_number,
        },
        source_upload_ids: new Set([uploadId]),
        fieldMeta: Object.fromEntries(
          BATTING_FIELDS.filter((f) => row[f] != null).map((f) => [f, meta])
        ),
      });
      continue;
    }

    existing.source_upload_ids.add(uploadId);
    if (identity.jersey_number && !existing.identity.jersey_number) {
      existing.identity.jersey_number = identity.jersey_number;
      existing.row.jersey_number = identity.jersey_number;
    }

    const playerLabel =
      identity.player_name ?? identity.merge_key ?? "unknown player";

    for (const field of BATTING_FIELDS) {
      const incomingValue = row[field];
      if (incomingValue == null) continue;

      const currentValue = existing.row[field];
      const currentMeta = existing.fieldMeta[field] ?? {
        confidence: existing.row.confidence,
        order: -1,
      };

      if (currentValue == null) {
        existing.row[field] = incomingValue;
        existing.fieldMeta[field] = meta;
        continue;
      }

      if (valuesEqual(currentValue, incomingValue)) continue;

      const merged = mergeField(
        field,
        playerLabel,
        { value: currentValue, meta: currentMeta },
        { value: incomingValue, meta },
        warnings
      );
      existing.row[field] = merged as never;
      if (valuesEqual(merged, incomingValue)) {
        existing.fieldMeta[field] = meta;
      }
    }

    existing.row.confidence = Math.max(existing.row.confidence, row.confidence);
  }

  return Array.from(byKey.values()).map(({ identity, row, source_upload_ids }) => ({
    ...row,
    player_name: identity.player_name,
    jersey_number: identity.jersey_number,
    source_upload_ids: Array.from(source_upload_ids),
  }));
}

export function mergePitchingStatRows(
  rows: SourcedRow<PitchingRow>[],
  warnings: string[] = []
): ConsolidatedPitchingRow[] {
  const canonicalMap = buildCanonicalKeyMap(collectIdentityEntries(rows));
  const byKey = new Map<
    string,
    {
      identity: ReturnType<typeof parsePlayerIdentity>;
      row: PitchingRow;
      source_upload_ids: Set<string>;
      fieldMeta: Partial<Record<(typeof PITCHING_FIELDS)[number], FieldMeta>>;
    }
  >();

  for (const { row, uploadId, order } of rows) {
    if (isExcludedPlayerRow(row.player_name)) continue;
    if (!pitchingHasStats(row)) continue;

    const identity = parsePlayerIdentity(row.player_name, row.jersey_number);
    const key = consolidationKeyForRow(row, canonicalMap);
    if (!key) continue;

    const meta: FieldMeta = { confidence: row.confidence, order };
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        identity,
        row: {
          ...row,
          player_name: identity.player_name,
          jersey_number: identity.jersey_number,
        },
        source_upload_ids: new Set([uploadId]),
        fieldMeta: Object.fromEntries(
          PITCHING_FIELDS.filter((f) => row[f] != null).map((f) => [f, meta])
        ),
      });
      continue;
    }

    existing.source_upload_ids.add(uploadId);
    if (identity.jersey_number && !existing.identity.jersey_number) {
      existing.identity.jersey_number = identity.jersey_number;
      existing.row.jersey_number = identity.jersey_number;
    }

    const playerLabel =
      identity.player_name ?? identity.merge_key ?? "unknown player";

    for (const field of PITCHING_FIELDS) {
      const incomingValue = row[field];
      if (incomingValue == null) continue;

      const currentValue = existing.row[field];
      const currentMeta = existing.fieldMeta[field] ?? {
        confidence: existing.row.confidence,
        order: -1,
      };

      if (currentValue == null) {
        existing.row[field] = incomingValue;
        existing.fieldMeta[field] = meta;
        continue;
      }

      if (valuesEqual(currentValue, incomingValue)) continue;

      const merged = mergeField(
        field,
        playerLabel,
        { value: currentValue, meta: currentMeta },
        { value: incomingValue, meta },
        warnings
      );
      existing.row[field] = merged as never;
      if (valuesEqual(merged, incomingValue)) {
        existing.fieldMeta[field] = meta;
      }
    }

    existing.row.confidence = Math.max(existing.row.confidence, row.confidence);
  }

  return Array.from(byKey.values()).map(({ identity, row, source_upload_ids }) => {
    if (row.total_pitches != null) row.pitches = row.total_pitches;
    else if (row.pitches != null) row.total_pitches = row.pitches;
    return {
      ...row,
      player_name: identity.player_name,
      jersey_number: identity.jersey_number,
      source_upload_ids: Array.from(source_upload_ids),
    };
  });
}

export function mergePlayerRows(
  rows: SourcedRow<PlayerRow>[]
): ConsolidatedPlayerRow[] {
  const canonicalMap = buildCanonicalKeyMap(collectIdentityEntries(rows));
  const byKey = new Map<
    string,
    {
      identity: ReturnType<typeof parsePlayerIdentity>;
      row: PlayerRow;
      source_upload_ids: Set<string>;
    }
  >();

  for (const { row, uploadId } of rows) {
    if (isExcludedPlayerRow(row.name)) continue;

    const identity = parsePlayerIdentity(row.name, row.jersey_number);
    const key = consolidationKeyForRow(
      { name: row.name, jersey_number: row.jersey_number },
      canonicalMap
    );
    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        identity,
        row: {
          ...row,
          name: identity.player_name,
          jersey_number: identity.jersey_number,
        },
        source_upload_ids: new Set([uploadId]),
      });
      continue;
    }

    existing.source_upload_ids.add(uploadId);
    if (identity.jersey_number && !existing.identity.jersey_number) {
      existing.identity.jersey_number = identity.jersey_number;
      existing.row.jersey_number = identity.jersey_number;
    }
    if (row.positions?.length) {
      const merged = new Set([
        ...(existing.row.positions ?? []),
        ...row.positions,
      ]);
      existing.row.positions = Array.from(merged);
    }
    existing.row.confidence = Math.max(existing.row.confidence, row.confidence);
  }

  return Array.from(byKey.values()).map(({ identity, row, source_upload_ids }) => ({
    ...row,
    name: identity.player_name,
    jersey_number: identity.jersey_number,
    source_upload_ids: Array.from(source_upload_ids),
  }));
}

function gameKey(game: GameRow): string | null {
  const date = game.game_date?.trim() ?? "";
  const opponent = game.opponent_name?.trim().toLowerCase() ?? "";
  if (!date && !opponent) return null;
  return `${date}|${opponent}|${game.result?.trim().toLowerCase() ?? ""}`;
}

export function mergeGameRows(
  rows: SourcedRow<GameRow>[],
  warnings: string[] = []
): ConsolidatedGameRow[] {
  const byKey = new Map<
    string,
    {
      row: GameRow;
      source_upload_ids: Set<string>;
      order: number;
    }
  >();

  for (const { row, uploadId, order } of rows) {
    const key = gameKey(row);
    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        row: { ...row },
        source_upload_ids: new Set([uploadId]),
        order,
      });
      continue;
    }

    existing.source_upload_ids.add(uploadId);
    const meta: FieldMeta = { confidence: row.confidence, order };
    const currentMeta: FieldMeta = {
      confidence: existing.row.confidence,
      order: existing.order,
    };

    const fields: (keyof GameRow)[] = [
      "opponent_name",
      "game_date",
      "result",
      "runs_for",
      "runs_against",
      "notes",
    ];

    for (const field of fields) {
      const incoming = row[field];
      if (incoming == null) continue;
      const current = existing.row[field];
      if (current == null) {
        existing.row[field] = incoming as never;
      } else if (!valuesEqual(current, incoming)) {
        existing.row[field] = mergeField(
          field,
          key,
          { value: current, meta: currentMeta },
          { value: incoming, meta },
          warnings
        ) as never;
      }
    }

    existing.row.confidence = Math.max(existing.row.confidence, row.confidence);
    if (order > existing.order) existing.order = order;
  }

  return Array.from(byKey.values()).map(({ row, source_upload_ids }) => ({
    ...row,
    source_upload_ids: Array.from(source_upload_ids),
  }));
}

export function extractionFromRawTable(
  rawTable: RawExtractedTable | null,
  screenshotType: string | null = null
): AIExtractionResult {
  return enrichExtractionResult({
    screenshot_type: (screenshotType as AIExtractionResult["screenshot_type"]) ?? "unknown",
    team_name: null,
    raw_extracted_table: rawTable ?? { headers: [], rows: [] },
    players: [],
    batting_stats: [],
    pitching_stats: [],
    games: [],
    warnings: [],
    unknowns: [],
  });
}

export interface UploadExtractionInput {
  uploadId: string;
  order: number;
  extraction: AIExtractionResult;
}

export function consolidateExtractions(
  uploads: UploadExtractionInput[]
): {
  players: ConsolidatedPlayerRow[];
  batting_stats: ConsolidatedBattingRow[];
  pitching_stats: ConsolidatedPitchingRow[];
  games: ConsolidatedGameRow[];
  warnings: string[];
} {
  const warnings: string[] = [];

  const battingSources: SourcedRow<BattingRow>[] = [];
  const pitchingSources: SourcedRow<PitchingRow>[] = [];
  const playerSources: SourcedRow<PlayerRow>[] = [];
  const gameSources: SourcedRow<GameRow>[] = [];

  for (const { uploadId, order, extraction } of uploads) {
    for (const row of extraction.batting_stats) {
      battingSources.push({ row, uploadId, order });
    }
    for (const row of extraction.pitching_stats) {
      pitchingSources.push({ row, uploadId, order });
    }
    for (const row of extraction.players) {
      playerSources.push({ row, uploadId, order });
    }
    for (const row of extraction.games) {
      gameSources.push({ row, uploadId, order });
    }
  }

  return {
    players: mergePlayerRows(playerSources),
    batting_stats: mergeBattingStatRows(battingSources, warnings),
    pitching_stats: mergePitchingStatRows(pitchingSources, warnings),
    games: mergeGameRows(gameSources, warnings),
    warnings,
  };
}
