import { buildLedgerDrafts } from "@/lib/scouting/ledger-build";
import type { OpponentDetail, PitchingLedgerEntry } from "@/types";

/** Prefer persisted ledger; fall back to in-memory build when migration not applied. */
export function resolveLedgerEntries(data: OpponentDetail): PitchingLedgerEntry[] {
  if (data.pitching_ledger_entries && data.pitching_ledger_entries.length > 0) {
    return data.pitching_ledger_entries;
  }

  return buildLedgerDrafts(data).map((draft, index) => ({
    id: `draft-${index}`,
    opponent_id: data.id,
    user_id: data.user_id,
    player_name: draft.player_name,
    jersey_number: draft.jersey_number,
    game_date: draft.game_date,
    opponent_played: draft.opponent_played,
    game_type: draft.game_type,
    tournament_name: draft.tournament_name,
    innings_pitched: draft.innings_pitched,
    pitch_count: draft.pitch_count,
    strikes: draft.strikes,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}
