-- Pitches-strikes from box score footer (e.g. 40-30 = 40 pitches, 30 strikes)
ALTER TABLE pitching_ledger_entries
ADD COLUMN IF NOT EXISTS strikes integer;
