-- Structured pitcher workload on game context (no screenshot required)
ALTER TABLE opponent_game_context
  ADD COLUMN IF NOT EXISTS pitcher_jersey_number text,
  ADD COLUMN IF NOT EXISTS pitcher_name text,
  ADD COLUMN IF NOT EXISTS innings_pitched numeric(4, 1),
  ADD COLUMN IF NOT EXISTS pitch_count integer,
  ADD COLUMN IF NOT EXISTS pitcher_role text DEFAULT 'unknown';
