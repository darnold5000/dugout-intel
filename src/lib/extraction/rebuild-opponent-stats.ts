import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIExtractionResult, ExtractionSummary } from "@/types";
import {
  consolidateExtractions,
  extractionFromRawTable,
} from "@/lib/extraction/consolidate-stats";

interface CompleteUpload {
  id: string;
  created_at: string;
  screenshot_type: string | null;
  raw_extracted_table: AIExtractionResult["raw_extracted_table"] | null;
}

export async function rebuildOpponentStats(
  supabase: SupabaseClient,
  opponentId: string,
  freshExtractions: Map<string, AIExtractionResult> = new Map()
): Promise<{ counts: ExtractionSummary; warnings: string[] }> {
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

  const extractionInputs = completeUploads.map((upload, index) => {
    const extraction =
      freshExtractions.get(upload.id) ??
      extractionFromRawTable(
        upload.raw_extracted_table,
        upload.screenshot_type
      );

    return {
      uploadId: upload.id,
      order: index,
      extraction,
    };
  });

  const consolidated = consolidateExtractions(extractionInputs);

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
    const { error } = await supabase.from("extracted_pitching_stats").insert({
      opponent_id: opponentId,
      player_name: stat.player_name,
      jersey_number: stat.jersey_number,
      innings_pitched: stat.innings_pitched,
      pitches: stat.pitches,
      strike_percentage: stat.strike_percentage,
      era: stat.era,
      walks: stat.walks,
      strikeouts: stat.strikeouts,
      hits_allowed: stat.hits_allowed,
      runs_allowed: stat.runs_allowed,
      confidence: stat.confidence,
      source_upload_id: stat.source_upload_ids[0] ?? null,
      source_upload_ids: stat.source_upload_ids,
    });
    if (error) throw new Error(`Failed to save pitching stats: ${error.message}`);
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

  return {
    counts: {
      players: consolidated.players.length,
      batting_stats: consolidated.batting_stats.length,
      pitching_stats: consolidated.pitching_stats.length,
      games: consolidated.games.length,
    },
    warnings: consolidated.warnings,
  };
}
