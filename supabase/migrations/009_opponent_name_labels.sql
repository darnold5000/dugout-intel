-- Human-readable team label on child rows (for Supabase table browsing)
ALTER TABLE screenshot_uploads
  ADD COLUMN IF NOT EXISTS opponent_name text;

ALTER TABLE pitching_ledger_entries
  ADD COLUMN IF NOT EXISTS opponent_name text;

ALTER TABLE opponent_game_context
  ADD COLUMN IF NOT EXISTS opponent_name text;

ALTER TABLE opponent_notes
  ADD COLUMN IF NOT EXISTS opponent_name text;

ALTER TABLE opponent_voice_notes
  ADD COLUMN IF NOT EXISTS opponent_name text;

-- Backfill from opponents
UPDATE screenshot_uploads su
SET opponent_name = o.name
FROM opponents o
WHERE o.id = su.opponent_id AND su.opponent_name IS NULL;

UPDATE pitching_ledger_entries ple
SET opponent_name = o.name
FROM opponents o
WHERE o.id = ple.opponent_id AND ple.opponent_name IS NULL;

UPDATE opponent_game_context gc
SET opponent_name = o.name
FROM opponents o
WHERE o.id = gc.opponent_id AND gc.opponent_name IS NULL;

UPDATE opponent_notes n
SET opponent_name = o.name
FROM opponents o
WHERE o.id = n.opponent_id AND n.opponent_name IS NULL;

UPDATE opponent_voice_notes v
SET opponent_name = o.name
FROM opponents o
WHERE o.id = v.opponent_id AND v.opponent_name IS NULL;

-- Keep labels in sync when a scouted team is renamed
CREATE OR REPLACE FUNCTION sync_opponent_name_labels()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE screenshot_uploads SET opponent_name = NEW.name WHERE opponent_id = NEW.id;
  UPDATE pitching_ledger_entries SET opponent_name = NEW.name WHERE opponent_id = NEW.id;
  UPDATE opponent_game_context SET opponent_name = NEW.name WHERE opponent_id = NEW.id;
  UPDATE opponent_notes SET opponent_name = NEW.name WHERE opponent_id = NEW.id;
  UPDATE opponent_voice_notes SET opponent_name = NEW.name WHERE opponent_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opponents_sync_name_labels ON opponents;
CREATE TRIGGER opponents_sync_name_labels
  AFTER UPDATE OF name ON opponents
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION sync_opponent_name_labels();
