import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLedgerDrafts } from "@/lib/scouting/ledger-build";
import type { OpponentDetail } from "@/types";

const LEDGER_MIGRATION_HINT =
  "Run supabase/migrations/007_pitching_ledger.sql in Supabase SQL editor.";

function isMissingLedgerTable(message: string): boolean {
  return /pitching_ledger_entries/i.test(message) && /schema cache|relation|column/i.test(message);
}

export async function rebuildPitchingLedger(
  supabase: SupabaseClient,
  opponentId: string,
  userId: string,
  data: OpponentDetail
): Promise<{ count: number; warning?: string }> {
  const drafts = buildLedgerDrafts(data);

  const { error: deleteError } = await supabase
    .from("pitching_ledger_entries")
    .delete()
    .eq("opponent_id", opponentId);

  if (deleteError) {
    if (isMissingLedgerTable(deleteError.message)) {
      return { count: 0, warning: LEDGER_MIGRATION_HINT };
    }
    throw new Error(`Failed to clear pitching ledger: ${deleteError.message}`);
  }

  if (!drafts.length) return { count: 0 };

  const rows = drafts.map((draft) => ({
    opponent_id: opponentId,
    user_id: userId,
    player_name: draft.player_name,
    jersey_number: draft.jersey_number,
    game_date: draft.game_date,
    opponent_played: draft.opponent_played,
    game_type: draft.game_type,
    tournament_name: draft.tournament_name,
    innings_pitched: draft.innings_pitched,
    pitch_count: draft.pitch_count,
    batters_faced: draft.batters_faced,
    strikeouts: draft.strikeouts,
    walks: draft.walks,
    hits_allowed: draft.hits_allowed,
    started_game: draft.started_game,
    finished_game: draft.finished_game,
    entered_inning: draft.entered_inning,
    score_when_entered: draft.score_when_entered,
    leverage: draft.leverage,
    source_type: draft.source_type,
    source_reference: draft.source_reference,
  }));

  const { error: insertError } = await supabase
    .from("pitching_ledger_entries")
    .insert(rows);

  if (insertError) {
    if (isMissingLedgerTable(insertError.message)) {
      return { count: 0, warning: LEDGER_MIGRATION_HINT };
    }
    throw new Error(`Failed to save pitching ledger: ${insertError.message}`);
  }

  return { count: rows.length };
}
