-- Improve extraction debugging and screenshot type support

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS raw_extracted_table jsonb;

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS extraction_warnings text[];

-- Allow schedule_results while keeping legacy values
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
  'unknown'
));
