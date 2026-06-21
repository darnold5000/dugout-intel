import type { LedgerSourceType, Leverage } from "@/types";

export interface LedgerEntryDraft {
  player_name: string | null;
  jersey_number: string | null;
  game_date: string | null;
  opponent_played: string | null;
  game_type: string;
  tournament_name: string | null;
  innings_pitched: number | null;
  pitch_count: number | null;
  strikes: number | null;
  batters_faced: number | null;
  strikeouts: number | null;
  walks: number | null;
  hits_allowed: number | null;
  started_game: boolean | null;
  finished_game: boolean | null;
  entered_inning: string | null;
  score_when_entered: string | null;
  leverage: Leverage | string;
  source_type: LedgerSourceType | string;
  source_reference: string | null;
}
