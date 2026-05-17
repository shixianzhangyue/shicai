-- V8: Candidate field enhancement for advanced filtering
-- Adds gender, birth_date, expected_city, expected_salary, graduation_date, school, major
-- Adds work_experiences and education_history as JSON columns
-- Adds is_starred, is_hidden, source_detail for talent pool features

ALTER TABLE candidates ADD COLUMN gender TEXT;
ALTER TABLE candidates ADD COLUMN birth_date TEXT;
ALTER TABLE candidates ADD COLUMN expected_city TEXT;
ALTER TABLE candidates ADD COLUMN expected_salary TEXT;
ALTER TABLE candidates ADD COLUMN graduation_date TEXT;
ALTER TABLE candidates ADD COLUMN school TEXT;
ALTER TABLE candidates ADD COLUMN major TEXT;
ALTER TABLE candidates ADD COLUMN is_starred INTEGER DEFAULT 0;
ALTER TABLE candidates ADD COLUMN is_hidden INTEGER DEFAULT 0;
ALTER TABLE candidates ADD COLUMN work_experiences TEXT DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN education_history TEXT DEFAULT '[]';
ALTER TABLE candidates ADD COLUMN source_detail TEXT;

-- Performance indexes for new filterable fields
CREATE INDEX IF NOT EXISTS idx_candidates_gender ON candidates(gender);
CREATE INDEX IF NOT EXISTS idx_candidates_expected_city ON candidates(expected_city);
CREATE INDEX IF NOT EXISTS idx_candidates_school ON candidates(school);
CREATE INDEX IF NOT EXISTS idx_candidates_starred ON candidates(is_starred) WHERE is_starred = 1;
CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates(source);

-- User preferences table for view settings etc.
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default',
  preference_key TEXT NOT NULL UNIQUE,
  preference_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
