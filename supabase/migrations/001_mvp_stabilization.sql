-- MVP Stabilization migration

ALTER TABLE screenshot_uploads
ADD COLUMN IF NOT EXISTS extraction_error text;

ALTER TABLE scouting_reports
ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE scouting_reports
ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_scouting_reports_share_token
ON scouting_reports(share_token)
WHERE share_token IS NOT NULL;

-- Public read policy for shared reports (via share_token lookup in API)
-- Share access is handled server-side using service role or anon with token validation
