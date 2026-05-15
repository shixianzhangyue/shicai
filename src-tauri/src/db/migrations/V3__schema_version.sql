-- Ensure schema version table exists (refinery automatically maintains this)
-- This migration is intentionally minimal to confirm refinery integration

CREATE TABLE IF NOT EXISTS _schema_version (
  version INTEGER PRIMARY KEY,
  applied_on TEXT NOT NULL,
  checksum TEXT NOT NULL
);
