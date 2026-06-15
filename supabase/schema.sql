-- GameChanger Screenshot Scout Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams (user's own team)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age_level TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opponents (scouted teams)
CREATE TABLE opponents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  age_level TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Screenshot uploads
CREATE TABLE screenshot_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  screenshot_type TEXT CHECK (screenshot_type IN ('roster', 'schedule', 'box_score', 'batting_stats', 'pitching_stats', 'game_summary', 'unknown')),
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'complete', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extracted players
CREATE TABLE extracted_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opponent_id UUID NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  name TEXT,
  jersey_number TEXT,
  positions TEXT[],
  bats TEXT,
  throws TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  source_upload_id UUID REFERENCES screenshot_uploads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extracted batting stats
CREATE TABLE extracted_batting_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opponent_id UUID NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  player_id UUID REFERENCES extracted_players(id) ON DELETE SET NULL,
  player_name TEXT,
  jersey_number TEXT,
  avg NUMERIC,
  obp NUMERIC,
  ops NUMERIC,
  hits INTEGER,
  walks INTEGER,
  strikeouts INTEGER,
  rbi INTEGER,
  runs INTEGER,
  stolen_bases INTEGER,
  confidence NUMERIC NOT NULL DEFAULT 0,
  source_upload_id UUID REFERENCES screenshot_uploads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extracted pitching stats
CREATE TABLE extracted_pitching_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opponent_id UUID NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  player_id UUID REFERENCES extracted_players(id) ON DELETE SET NULL,
  player_name TEXT,
  jersey_number TEXT,
  innings_pitched NUMERIC,
  pitches INTEGER,
  strike_percentage NUMERIC,
  era NUMERIC,
  walks INTEGER,
  strikeouts INTEGER,
  hits_allowed INTEGER,
  runs_allowed INTEGER,
  confidence NUMERIC NOT NULL DEFAULT 0,
  source_upload_id UUID REFERENCES screenshot_uploads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extracted games
CREATE TABLE extracted_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opponent_id UUID NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  opponent_name TEXT,
  game_date DATE,
  result TEXT,
  runs_for INTEGER,
  runs_against INTEGER,
  notes TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  source_upload_id UUID REFERENCES screenshot_uploads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scouting reports
CREATE TABLE scouting_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opponent_id UUID NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_json JSONB NOT NULL DEFAULT '{}',
  report_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_opponents_user_id ON opponents(user_id);
CREATE INDEX idx_screenshot_uploads_opponent_id ON screenshot_uploads(opponent_id);
CREATE INDEX idx_extracted_players_opponent_id ON extracted_players(opponent_id);
CREATE INDEX idx_extracted_batting_stats_opponent_id ON extracted_batting_stats(opponent_id);
CREATE INDEX idx_extracted_pitching_stats_opponent_id ON extracted_pitching_stats(opponent_id);
CREATE INDEX idx_extracted_games_opponent_id ON extracted_games(opponent_id);
CREATE INDEX idx_scouting_reports_opponent_id ON scouting_reports(opponent_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_opponents_updated_at
  BEFORE UPDATE ON opponents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scouting_reports_updated_at
  BEFORE UPDATE ON scouting_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponents ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshot_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_batting_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_pitching_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouting_reports ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view own teams" ON teams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own teams" ON teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own teams" ON teams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own teams" ON teams FOR DELETE USING (auth.uid() = user_id);

-- Opponents policies
CREATE POLICY "Users can view own opponents" ON opponents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own opponents" ON opponents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own opponents" ON opponents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own opponents" ON opponents FOR DELETE USING (auth.uid() = user_id);

-- Screenshot uploads policies
CREATE POLICY "Users can view own uploads" ON screenshot_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own uploads" ON screenshot_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own uploads" ON screenshot_uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON screenshot_uploads FOR DELETE USING (auth.uid() = user_id);

-- Extracted data policies (via opponent ownership)
CREATE POLICY "Users can view own extracted players" ON extracted_players FOR SELECT
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_players.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can insert own extracted players" ON extracted_players FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_players.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can update own extracted players" ON extracted_players FOR UPDATE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_players.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can delete own extracted players" ON extracted_players FOR DELETE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_players.opponent_id AND opponents.user_id = auth.uid()));

CREATE POLICY "Users can view own batting stats" ON extracted_batting_stats FOR SELECT
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_batting_stats.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can insert own batting stats" ON extracted_batting_stats FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_batting_stats.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can update own batting stats" ON extracted_batting_stats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_batting_stats.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can delete own batting stats" ON extracted_batting_stats FOR DELETE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_batting_stats.opponent_id AND opponents.user_id = auth.uid()));

CREATE POLICY "Users can view own pitching stats" ON extracted_pitching_stats FOR SELECT
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_pitching_stats.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can insert own pitching stats" ON extracted_pitching_stats FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_pitching_stats.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can update own pitching stats" ON extracted_pitching_stats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_pitching_stats.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can delete own pitching stats" ON extracted_pitching_stats FOR DELETE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_pitching_stats.opponent_id AND opponents.user_id = auth.uid()));

CREATE POLICY "Users can view own extracted games" ON extracted_games FOR SELECT
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_games.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can insert own extracted games" ON extracted_games FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_games.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can update own extracted games" ON extracted_games FOR UPDATE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_games.opponent_id AND opponents.user_id = auth.uid()));
CREATE POLICY "Users can delete own extracted games" ON extracted_games FOR DELETE
  USING (EXISTS (SELECT 1 FROM opponents WHERE opponents.id = extracted_games.opponent_id AND opponents.user_id = auth.uid()));

-- Scouting reports policies
CREATE POLICY "Users can view own reports" ON scouting_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON scouting_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON scouting_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON scouting_reports FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('gamechanger-screenshots', 'gamechanger-screenshots', true);

-- Storage policies
-- CREATE POLICY "Users can upload screenshots" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'gamechanger-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can view own screenshots" ON storage.objects FOR SELECT
--   USING (bucket_id = 'gamechanger-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete own screenshots" ON storage.objects FOR DELETE
--   USING (bucket_id = 'gamechanger-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
