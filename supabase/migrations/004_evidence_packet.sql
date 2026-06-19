-- Dugout Intel: evidence packet tables and screenshot enhancements

-- Expand screenshot types
ALTER TABLE screenshot_uploads
DROP CONSTRAINT IF EXISTS screenshot_uploads_screenshot_type_check;

ALTER TABLE screenshot_uploads
ADD CONSTRAINT screenshot_uploads_screenshot_type_check
CHECK (screenshot_type IN (
  'roster',
  'batting_stats',
  'pitching_stats',
  'schedule_results',
  'box_score',
  'schedule',
  'game_summary',
  'bracket_tournament',
  'unknown'
));

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS included_in_report boolean DEFAULT true;

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS game_date date;

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS opponent_played text;

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS tournament_name text;

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS game_type text DEFAULT 'unknown';

-- Written coach notes
CREATE TABLE IF NOT EXISTS opponent_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note_text text NOT NULL,
  note_type text DEFAULT 'general',
  importance text DEFAULT 'medium',
  game_date date,
  opponent_played text,
  game_type text DEFAULT 'unknown',
  included_in_report boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Uploaded documents
CREATE TABLE IF NOT EXISTS opponent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  extracted_text text,
  included_in_report boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Voice notes
CREATE TABLE IF NOT EXISTS opponent_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  audio_file_path text,
  transcript_text text,
  note_type text DEFAULT 'general',
  game_type text DEFAULT 'unknown',
  game_date date,
  opponent_played text,
  included_in_report boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Standalone game context entries
CREATE TABLE IF NOT EXISTS opponent_game_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  game_date date,
  opponent_played text,
  tournament_name text,
  game_type text DEFAULT 'unknown',
  inning_observed text,
  score_when_pitcher_entered text,
  reason_pitcher_entered text DEFAULT 'unknown',
  leverage text DEFAULT 'medium',
  notes text,
  included_in_report boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opponent_notes_opponent_id ON opponent_notes(opponent_id);
CREATE INDEX IF NOT EXISTS idx_opponent_documents_opponent_id ON opponent_documents(opponent_id);
CREATE INDEX IF NOT EXISTS idx_opponent_voice_notes_opponent_id ON opponent_voice_notes(opponent_id);
CREATE INDEX IF NOT EXISTS idx_opponent_game_context_opponent_id ON opponent_game_context(opponent_id);

-- RLS
ALTER TABLE opponent_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponent_voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponent_game_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON opponent_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON opponent_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON opponent_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON opponent_notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own documents" ON opponent_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON opponent_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON opponent_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON opponent_documents FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own voice notes" ON opponent_voice_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own voice notes" ON opponent_voice_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voice notes" ON opponent_voice_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own voice notes" ON opponent_voice_notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own game context" ON opponent_game_context FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own game context" ON opponent_game_context FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own game context" ON opponent_game_context FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own game context" ON opponent_game_context FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_opponent_notes_updated_at
  BEFORE UPDATE ON opponent_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opponent_game_context_updated_at
  BEFORE UPDATE ON opponent_game_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
