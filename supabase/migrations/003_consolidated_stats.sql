-- Consolidated stats: track all source uploads per player row
ALTER TABLE extracted_batting_stats
  ADD COLUMN IF NOT EXISTS source_upload_ids UUID[];

ALTER TABLE extracted_pitching_stats
  ADD COLUMN IF NOT EXISTS source_upload_ids UUID[];

-- Run rebuild-consolidated-stats script/API on existing opponents before enabling:
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_batting_opponent_player
--   ON extracted_batting_stats (
--     opponent_id,
--     lower(coalesce(player_name, '')),
--     coalesce(jersey_number, '')
--   );
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_pitching_opponent_player
--   ON extracted_pitching_stats (
--     opponent_id,
--     lower(coalesce(player_name, '')),
--     coalesce(jersey_number, '')
--   );
