-- Optional manual W/L and score on game context (links to extracted_games at display time)

ALTER TABLE opponent_game_context
ADD COLUMN IF NOT EXISTS result text;

ALTER TABLE opponent_game_context
ADD COLUMN IF NOT EXISTS runs_for integer;

ALTER TABLE opponent_game_context
ADD COLUMN IF NOT EXISTS runs_against integer;
