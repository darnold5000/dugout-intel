-- Tournament pitching ledger & configurable availability rules

CREATE TABLE IF NOT EXISTS pitching_rule_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  age_level text,
  rules_json jsonb NOT NULL DEFAULT '{}',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pitching_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  player_name text,
  jersey_number text,
  game_date date,
  opponent_played text,
  game_type text DEFAULT 'unknown',
  tournament_name text,
  innings_pitched numeric,
  pitch_count integer,
  batters_faced integer,
  strikeouts integer,
  walks integer,
  hits_allowed integer,
  started_game boolean,
  finished_game boolean,
  entered_inning text,
  score_when_entered text,
  leverage text DEFAULT 'medium',
  source_type text NOT NULL,
  source_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pitching_ledger_opponent
  ON pitching_ledger_entries(opponent_id);

CREATE INDEX IF NOT EXISTS idx_pitching_ledger_opponent_date
  ON pitching_ledger_entries(opponent_id, game_date);

ALTER TABLE pitching_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitching_rule_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY pitching_ledger_entries_user ON pitching_ledger_entries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY pitching_rule_profiles_user ON pitching_rule_profiles
  FOR ALL USING (auth.uid() = user_id);
