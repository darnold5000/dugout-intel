export type ScreenshotType =
  | "roster"
  | "batting_stats"
  | "pitching_stats"
  | "schedule_results"
  | "box_score"
  | "unknown"
  | "schedule"
  | "game_summary"
  | "bracket_tournament";

export type NoteType =
  | "general"
  | "pitching"
  | "hitting"
  | "baserunning"
  | "defense"
  | "tournament_context"
  | "gamechanger_recap";

export type Importance = "low" | "medium" | "high";

export type GameType =
  | "unknown"
  | "pool_play"
  | "bracket_play"
  | "quarterfinal"
  | "semifinal"
  | "championship"
  | "friendly"
  | "scrimmage";

export type Leverage = "low" | "medium" | "high" | "critical";

export type PitchingAvailability =
  | "available"
  | "limited"
  | "emergency_only"
  | "unavailable";

export type LedgerSourceType =
  | "screenshot"
  | "box_score"
  | "pitching_stats"
  | "schedule"
  | "scout_note"
  | "voice_note"
  | "document"
  | "game_context"
  | "recap";

export type ReasonPitcherEntered =
  | "unknown"
  | "starter_struggling"
  | "planned_rotation"
  | "pitch_count_management"
  | "save_best_pitcher"
  | "close_game"
  | "blowout";

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
  included_in_report?: boolean;
  game_date?: string | null;
  opponent_played?: string | null;
  tournament_name?: string | null;
  game_type?: GameType | string | null;
  created_at: string;
}

export interface OpponentNote {
  id: string;
  opponent_id: string;
  user_id: string;
  note_text: string;
  note_type: NoteType | string;
  importance: Importance | string;
  game_date: string | null;
  opponent_played: string | null;
  game_type: GameType | string;
  included_in_report: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpponentDocument {
  id: string;
  opponent_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  extracted_text: string | null;
  included_in_report: boolean;
  created_at: string;
}

export interface OpponentVoiceNote {
  id: string;
  opponent_id: string;
  user_id: string;
  audio_file_path: string | null;
  transcript_text: string | null;
  note_type: NoteType | string;
  game_type: GameType | string;
  game_date: string | null;
  opponent_played: string | null;
  included_in_report: boolean;
  created_at: string;
}

export type PitcherAppearanceRole =
  | "unknown"
  | "starter"
  | "relief"
  | "closer";

export interface OpponentGameContext {
  id: string;
  opponent_id: string;
  user_id: string;
  game_date: string | null;
  opponent_played: string | null;
  tournament_name: string | null;
  game_type: GameType | string;
  inning_observed: string | null;
  score_when_pitcher_entered: string | null;
  reason_pitcher_entered: ReasonPitcherEntered | string;
  leverage: Leverage | string;
  notes: string | null;
  result: string | null;
  runs_for: number | null;
  runs_against: number | null;
  pitcher_jersey_number: string | null;
  pitcher_name: string | null;
  innings_pitched: number | null;
  pitch_count: number | null;
  pitcher_role: PitcherAppearanceRole | string;
  included_in_report: boolean;
  created_at: string;
  updated_at: string;
}

export interface PitchingRuleProfile {
  id: string;
  user_id: string;
  name: string;
  age_level: string | null;
  rules_json: PitchingRulesConfig;
  is_default: boolean;
  created_at: string;
}

/** Configurable USSSA-style pitching limits — not hardcoded in logic. */
export interface PitchingRulesConfig {
  max_innings_per_day?: number;
  innings_trigger_rest_day?: number;
  rest_days_after_heavy_day?: number;
  max_innings_rolling_window?: number;
  rolling_window_days?: number;
  max_pitches_per_day?: number;
  tournament_innings_cap?: number;
}

export interface PitchingLedgerEntry {
  id: string;
  opponent_id: string;
  user_id: string;
  player_name: string | null;
  jersey_number: string | null;
  game_date: string | null;
  opponent_played: string | null;
  game_type: GameType | string;
  tournament_name: string | null;
  innings_pitched: number | null;
  pitch_count: number | null;
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
  created_at: string;
  updated_at: string;
}

export interface PitcherLedgerSummary {
  playerKey: string;
  playerName: string | null;
  jerseyNumber: string | null;
  label: string;
  totalInnings: number;
  totalPitches: number;
  gameCount: number;
  poolAppearances: number;
  bracketAppearances: number;
  championshipAppearances: number;
  finishedGames: number;
  importanceScore: number;
  importanceAssessment: string;
  availability: PitchingAvailability;
  availabilityConfidence: "low" | "medium" | "high";
  remainingInningsEstimate: number | null;
  weekendCapacityPct: number | null;
  roleLabels: string[];
  appearances: PitchingLedgerEntry[];
}

export interface PitchingLedgerOutlook {
  likelyStarter: PitcherLedgerSummary | null;
  primaryRelief: PitcherLedgerSummary | null;
  likelyCloser: PitcherLedgerSummary | null;
  unavailable: PitcherLedgerSummary[];
  limited: PitcherLedgerSummary[];
  available: PitcherLedgerSummary[];
  depthRating: "Thin" | "Moderate" | "Deep";
  ace: PitcherLedgerSummary | null;
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
  /** @deprecated Use total_pitches */
  pitches: number | null;
  batters_faced: number | null;
  total_pitches: number | null;
  strikes: number | null;
  strike_percentage: number | null;
  first_pitch_strike_pct: number | null;
  era: number | null;
  walks: number | null;
  strikeouts: number | null;
  hits_allowed: number | null;
  runs_allowed: number | null;
  earned_runs: number | null;
  k_bb_ratio: number | null;
  walks_per_inning: number | null;
  pitches_per_inning: number | null;
  pitches_per_batter_faced: number | null;
  one_two_three_innings: number | null;
  leadoff_outs: number | null;
  swing_miss_pct: number | null;
  baa: number | null;
  babip: number | null;
  fip: number | null;
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
  /** Report structure 2.1 */
  executive_summary?: string;
  key_players?: string[];
  pitching_staff_breakdown?: string;
  pitcher_usage_context?: string;
  offensive_threats?: string;
  baserunning_threats?: string;
  weaknesses_to_attack?: string;
  recommended_game_plan?: string;
  evidence_and_confidence?: string;
  /** Legacy fields (v1 reports) */
  opponent_summary: string;
  offensive_tendencies: string;
  pitching_notes: string;
  players_to_watch: string[];
  weaknesses_opportunities: string;
  suggested_game_plan: string;
  confidence_level: string;
  unknowns_data_gaps: string[];
  /** Dugout Intel 2.0 structured sections */
  team_identity?: TeamIdentity;
  confidence_by_category?: ConfidenceByCategory;
  offensive_leaders?: LeaderEntry[];
  pitching_leaders?: PitchingLeaders;
  player_scouting_cards?: PlayerScoutingCard[];
  base_running_threats?: LeaderEntry[];
  lineup_threat_tiers?: ThreatTierGroup;
  pitching_hierarchy?: PitchingTierGroup;
  first_pitch_strike_analysis?: FirstPitchAnalysis;
  pitch_count_leaders?: LeaderEntry[];
  players_to_attack?: string[];
  players_to_avoid?: string[];
}

export interface LeaderEntry {
  label: string;
  jersey_number: string | null;
  player_name: string;
  stat_line: string;
  interpretation?: string;
}

export interface PitchingLeaders {
  ace_pitcher: LeaderEntry | null;
  strike_thrower: LeaderEntry | null;
  swing_and_miss: LeaderEntry | null;
  control_problems: LeaderEntry | null;
  contact_pitcher: LeaderEntry | null;
}

export interface PlayerScoutingCard {
  jersey_number: string | null;
  player_name: string;
  key_stats: string;
  assessment: string;
  /** Advice for our team on how to approach this opponent player. */
  how_to_attack: string;
  /** @deprecated Use how_to_attack — kept for older saved reports */
  game_plan?: string;
  role: "hitter" | "pitcher" | "two-way";
}

export interface ThreatTierGroup {
  tier_1: string[];
  tier_2: string[];
  tier_3: string[];
}

export interface PitchingTierGroup {
  tier_1: string[];
  tier_2: string[];
  tier_3: string[];
}

export interface FirstPitchAnalysis {
  gets_ahead: LeaderEntry[];
  falls_behind: LeaderEntry[];
}

export interface TeamIdentity {
  offensive_strength: string;
  power: string;
  speed: string;
  patience: string;
  pitching_depth: string;
}

export interface ConfidenceByCategory {
  offense: string;
  pitching: string;
  baserunning: string;
  defense: string;
}

export interface TeamIntelligence {
  profiles: import("@/lib/scouting/player-profiles").PlayerProfile[];
  offensiveLeaders: Record<string, LeaderEntry | null>;
  pitchingLeaders: PitchingLeaders;
  baseRunningThreats: LeaderEntry[];
  lineupThreatTiers: ThreatTierGroup;
  pitchingHierarchy: PitchingTierGroup;
  firstPitchAnalysis: FirstPitchAnalysis;
  pitchCountLeaders: LeaderEntry[];
  teamIdentity: TeamIdentity;
  confidenceByCategory: ConfidenceByCategory;
  playerScoutingCards: PlayerScoutingCard[];
  playersToAttack: PlayerScoutingCard[];
  playersToAvoid: PlayerScoutingCard[];
  dataGaps: string[];
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
    total_pitches: number | null;
    batters_faced: number | null;
    strikes: number | null;
    strike_percentage: number | null;
    first_pitch_strike_pct: number | null;
    era: number | null;
    walks: number | null;
    strikeouts: number | null;
    hits_allowed: number | null;
    runs_allowed: number | null;
    earned_runs: number | null;
    k_bb_ratio: number | null;
    walks_per_inning: number | null;
    pitches_per_inning: number | null;
    pitches_per_batter_faced: number | null;
    one_two_three_innings: number | null;
    leadoff_outs: number | null;
    swing_miss_pct: number | null;
    baa: number | null;
    babip: number | null;
    fip: number | null;
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
  opponent_notes?: OpponentNote[];
  opponent_documents?: OpponentDocument[];
  opponent_voice_notes?: OpponentVoiceNote[];
  opponent_game_context?: OpponentGameContext[];
  pitching_ledger_entries?: PitchingLedgerEntry[];
  extracted_players: ExtractedPlayer[];
  extracted_batting_stats: ExtractedBattingStat[];
  extracted_pitching_stats: ExtractedPitchingStat[];
  extracted_games: ExtractedGame[];
  scouting_reports: ScoutingReport[];
}
