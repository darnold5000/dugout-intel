export type ScreenshotType =
  | "roster"
  | "batting_stats"
  | "pitching_stats"
  | "schedule_results"
  | "box_score"
  | "unknown"
  | "schedule"
  | "game_summary";

export interface RawExtractedTable {
  headers: string[];
  rows: string[][];
}

export type ExtractionStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed";

export interface Team {
  id: string;
  user_id: string;
  name: string;
  age_level: string;
  created_at: string;
}

export interface Opponent {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  age_level: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreenshotUpload {
  id: string;
  user_id: string;
  opponent_id: string;
  file_url: string;
  file_path: string;
  screenshot_type: ScreenshotType | null;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
  raw_extracted_table: RawExtractedTable | null;
  extraction_warnings: string[] | null;
  created_at: string;
}

export interface ExtractedPlayer {
  id: string;
  opponent_id: string;
  name: string | null;
  jersey_number: string | null;
  positions: string[] | null;
  bats: string | null;
  throws: string | null;
  confidence: number;
  source_upload_id: string | null;
  created_at: string;
}

export interface ExtractedBattingStat {
  id: string;
  opponent_id: string;
  player_id: string | null;
  player_name: string | null;
  jersey_number: string | null;
  avg: number | null;
  obp: number | null;
  ops: number | null;
  hits: number | null;
  walks: number | null;
  strikeouts: number | null;
  rbi: number | null;
  runs: number | null;
  stolen_bases: number | null;
  confidence: number;
  source_upload_id: string | null;
  source_upload_ids?: string[] | null;
  created_at: string;
}

export interface ExtractedPitchingStat {
  id: string;
  opponent_id: string;
  player_id: string | null;
  player_name: string | null;
  jersey_number: string | null;
  innings_pitched: number | null;
  pitches: number | null;
  strike_percentage: number | null;
  era: number | null;
  walks: number | null;
  strikeouts: number | null;
  hits_allowed: number | null;
  runs_allowed: number | null;
  confidence: number;
  source_upload_id: string | null;
  source_upload_ids?: string[] | null;
  created_at: string;
}

export interface ExtractedGame {
  id: string;
  opponent_id: string;
  opponent_name: string | null;
  game_date: string | null;
  result: string | null;
  runs_for: number | null;
  runs_against: number | null;
  notes: string | null;
  confidence: number;
  source_upload_id: string | null;
  created_at: string;
}

export interface ScoutingReport {
  id: string;
  opponent_id: string;
  user_id: string;
  title: string | null;
  share_token: string | null;
  report_json: ScoutingReportJson;
  report_text: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractionSummary {
  players: number;
  batting_stats: number;
  pitching_stats: number;
  games: number;
}

export interface ExtractionResult {
  upload_id: string;
  status: "complete" | "failed";
  screenshot_type?: string;
  counts?: ExtractionSummary;
  raw_extracted_table?: RawExtractedTable | null;
  warnings?: string[];
  unknowns?: string[];
  error?: string;
}

export interface ScoutingReportJson {
  opponent_summary: string;
  offensive_tendencies: string;
  pitching_notes: string;
  players_to_watch: string[];
  weaknesses_opportunities: string;
  suggested_game_plan: string;
  confidence_level: string;
  unknowns_data_gaps: string[];
}

export interface AIExtractionResult {
  screenshot_type: ScreenshotType;
  team_name: string | null;
  raw_extracted_table: RawExtractedTable;
  players: {
    name: string | null;
    jersey_number: string | null;
    positions: string[] | null;
    confidence: number;
  }[];
  batting_stats: {
    player_name: string | null;
    jersey_number: string | null;
    avg: number | null;
    obp: number | null;
    ops: number | null;
    hits: number | null;
    walks: number | null;
    strikeouts: number | null;
    rbi: number | null;
    runs: number | null;
    stolen_bases: number | null;
    confidence: number;
  }[];
  pitching_stats: {
    player_name: string | null;
    jersey_number: string | null;
    innings_pitched: number | null;
    pitches: number | null;
    strike_percentage: number | null;
    era: number | null;
    walks: number | null;
    strikeouts: number | null;
    hits_allowed: number | null;
    runs_allowed: number | null;
    confidence: number;
  }[];
  games: {
    opponent_name: string | null;
    game_date: string | null;
    result: string | null;
    runs_for: number | null;
    runs_against: number | null;
    notes: string | null;
    confidence: number;
  }[];
  warnings: string[];
  unknowns: string[];
}

export interface OpponentDetail extends Opponent {
  screenshot_uploads: ScreenshotUpload[];
  extracted_players: ExtractedPlayer[];
  extracted_batting_stats: ExtractedBattingStat[];
  extracted_pitching_stats: ExtractedPitchingStat[];
  extracted_games: ExtractedGame[];
  scouting_reports: ScoutingReport[];
}
