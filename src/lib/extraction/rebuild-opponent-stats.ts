import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIExtractionResult, ExtractionSummary } from "@/types";
import {
  buildMergeDiagnostic,
  findPotentialDuplicates,
  type MergeDiagnostic,
  type PotentialDuplicate,
} from "@/lib/extraction/player-identity";
import {
  consolidateExtractions,
  extractionFromRawTable,
  type ConsolidatedPitchingRow,
} from "@/lib/extraction/consolidate-stats";

interface CompleteUpload {
  id: string;
  created_at: string;
  screenshot_type: string | null;
  raw_extracted_table: AIExtractionResult["raw_extracted_table"] | null;
}

const EARNED_RUNS_MIGRATION_SQL =
  "ALTER TABLE extracted_pitching_stats ADD COLUMN IF NOT EXISTS earned_runs INTEGER;";

function isMissingEarnedRunsColumn(message: string): boolean {
  return /earned_runs/i.test(message) && /schema cache|column/i.test(message);
}

function buildPitchingStatInsert(
  opponentId: string,
  stat: ConsolidatedPitchingRow,
  options: { includeEarnedRuns: boolean }
) {
  const totalPitches = stat.total_pitches ?? stat.pitches;
  const row = {
    opponent_id: opponentId,
    player_name: stat.player_name,
    jersey_number: stat.jersey_number,
    innings_pitched: stat.innings_pitched,
    pitches: totalPitches,
    total_pitches: totalPitches,
    batters_faced: stat.batters_faced,
    strikes: stat.strikes,
    strike_percentage: stat.strike_percentage,
    first_pitch_strike_pct: stat.first_pitch_strike_pct,
    era: stat.era,
    walks: stat.walks,
    strikeouts: stat.strikeouts,
    hits_allowed: stat.hits_allowed,
    runs_allowed: stat.runs_allowed,
    k_bb_ratio: stat.k_bb_ratio,
    walks_per_inning: stat.walks_per_inning,
    pitches_per_inning: stat.pitches_per_inning,
    pitches_per_batter_faced: stat.pitches_per_batter_faced,
    one_two_three_innings: stat.one_two_three_innings,
    leadoff_outs: stat.leadoff_outs,
    swing_miss_pct: stat.swing_miss_pct,
    baa: stat.baa,
    babip: stat.babip,
    fip: stat.fip,
    confidence: stat.confidence,
    source_upload_id: stat.source_upload_ids[0] ?? null,
    source_upload_ids: stat.source_upload_ids,
  };
  if (options.includeEarnedRuns) {
    return { ...row, earned_runs: stat.earned_runs };
  }
  return row;
}

export interface RebuildResult {
  counts: ExtractionSummary;
  warnings: string[];
  merge_diagnostics: MergeDiagnostic[];
  potential_duplicates: PotentialDuplicate[];
  duplicate_player_count: number;
}

export async function rebuildOpponentStats(
  supabase: SupabaseClient,
  opponentId: string,
  freshExtractions: Map<string, AIExtractionResult> = new Map(),
  options: { includeDiagnostics?: boolean } = {}
): Promise<RebuildResult> {
  const { data: uploads, error: fetchError } = await supabase
    .from("screenshot_uploads")
    .select("id, created_at, screenshot_type, raw_extracted_table, extraction_status")
    .eq("opponent_id", opponentId)
    .not("raw_extracted_table", "is", null)
    .neq("extraction_status", "processing")
    .order("created_at", { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to load uploads: ${fetchError.message}`);
  }

  const completeUploads = (uploads ?? []) as CompleteUpload[];
  const merge_diagnostics: MergeDiagnostic[] = [];
  const rawIdentityEntries: Array<{ name: string | null; jersey: string | null }> = [];

  const extractionInputs = completeUploads.map((upload, index) => {
    const extraction =
      freshExtractions.get(upload.id) ??
      extractionFromRawTable(
        upload.raw_extracted_table,
        upload.screenshot_type
      );

    if (options.includeDiagnostics !== false) {
      for (const row of extraction.batting_stats) {
        merge_diagnostics.push(
          buildMergeDiagnostic(row.player_name, row.jersey_number)
        );
        rawIdentityEntries.push({
          name: row.player_name,
          jersey: row.jersey_number,
        });
      }
      for (const row of extraction.pitching_stats) {
        merge_diagnostics.push(
          buildMergeDiagnostic(row.player_name, row.jersey_number)
        );
        rawIdentityEntries.push({
          name: row.player_name,
          jersey: row.jersey_number,
        });
      }
    }

    return {
      uploadId: upload.id,
      order: index,
      extraction,
    };
  });

  const consolidated = consolidateExtractions(extractionInputs);
  const potential_duplicates = findPotentialDuplicates(rawIdentityEntries);
  const rebuildWarnings = [...consolidated.warnings];
  let earnedRunsColumnMissing = false;

  await supabase
    .from("extracted_players")
    .delete()
    .eq("opponent_id", opponentId);
  await supabase
    .from("extracted_batting_stats")
    .delete()
    .eq("opponent_id", opponentId);
  await supabase
    .from("extracted_pitching_stats")
    .delete()
    .eq("opponent_id", opponentId);
  await supabase.from("extracted_games").delete().eq("opponent_id", opponentId);

  for (const player of consolidated.players) {
    const { error } = await supabase.from("extracted_players").insert({
      opponent_id: opponentId,
      name: player.name,
      jersey_number: player.jersey_number,
      positions: player.positions,
      confidence: player.confidence,
      source_upload_id: player.source_upload_ids[0] ?? null,
    });
    if (error) throw new Error(`Failed to save players: ${error.message}`);
  }

  for (const stat of consolidated.batting_stats) {
    const { error } = await supabase.from("extracted_batting_stats").insert({
      opponent_id: opponentId,
      player_name: stat.player_name,
      jersey_number: stat.jersey_number,
      avg: stat.avg,
      obp: stat.obp,
      ops: stat.ops,
      hits: stat.hits,
      walks: stat.walks,
      strikeouts: stat.strikeouts,
      rbi: stat.rbi,
      runs: stat.runs,
      stolen_bases: stat.stolen_bases,
      confidence: stat.confidence,
      source_upload_id: stat.source_upload_ids[0] ?? null,
      source_upload_ids: stat.source_upload_ids,
    });
    if (error) throw new Error(`Failed to save batting stats: ${error.message}`);
  }

  for (const stat of consolidated.pitching_stats) {
    let includeEarnedRuns = !earnedRunsColumnMissing;
    let row = buildPitchingStatInsert(opponentId, stat, { includeEarnedRuns });
    let { error } = await supabase.from("extracted_pitching_stats").insert(row);

    if (error && includeEarnedRuns && isMissingEarnedRunsColumn(error.message)) {
      earnedRunsColumnMissing = true;
      includeEarnedRuns = false;
      row = buildPitchingStatInsert(opponentId, stat, { includeEarnedRuns });
      ({ error } = await supabase.from("extracted_pitching_stats").insert(row));
    }

    if (error) {
      if (isMissingEarnedRunsColumn(error.message)) {
        throw new Error(
          `Database migration required for ER column. In Supabase SQL editor run: ${EARNED_RUNS_MIGRATION_SQL}`
        );
      }
      throw new Error(`Failed to save pitching stats: ${error.message}`);
    }
  }

  if (earnedRunsColumnMissing) {
    rebuildWarnings.push(
      `Earned runs (ER) were not saved — run this in Supabase SQL editor: ${EARNED_RUNS_MIGRATION_SQL}`
    );
  }

  for (const game of consolidated.games) {
    const { error } = await supabase.from("extracted_games").insert({
      opponent_id: opponentId,
      opponent_name: game.opponent_name,
      game_date: game.game_date,
      result: game.result,
      runs_for: game.runs_for,
      runs_against: game.runs_against,
      notes: game.notes,
      confidence: game.confidence,
      source_upload_id: game.source_upload_ids[0] ?? null,
    });
    if (error) throw new Error(`Failed to save games: ${error.message}`);
  }

  const playerCount = consolidated.players.length;
  const battingCount = consolidated.batting_stats.length;

  return {
    counts: {
      players: playerCount,
      batting_stats: battingCount,
      pitching_stats: consolidated.pitching_stats.length,
      games: consolidated.games.length,
    },
    warnings: rebuildWarnings,
    merge_diagnostics,
    potential_duplicates,
    duplicate_player_count: potential_duplicates.length,
  };
}
