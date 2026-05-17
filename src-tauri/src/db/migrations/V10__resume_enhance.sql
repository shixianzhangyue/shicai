-- V10: Resume multi-version, portfolio, and parse log support

-- Extend resumes table for multi-version and typed resumes
ALTER TABLE resumes ADD COLUMN resume_type TEXT DEFAULT 'original';
ALTER TABLE resumes ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE resumes ADD COLUMN is_current INTEGER DEFAULT 1;
ALTER TABLE resumes ADD COLUMN parsed_by TEXT;
ALTER TABLE resumes ADD COLUMN parsed_at TEXT;
ALTER TABLE resumes ADD COLUMN raw_text TEXT;
ALTER TABLE resumes ADD COLUMN parsed_json TEXT;

-- Indexes for resume querying
CREATE INDEX IF NOT EXISTS idx_resumes_type ON resumes(resume_type);
CREATE INDEX IF NOT EXISTS idx_resumes_current ON resumes(is_current) WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_resumes_candidate_type ON resumes(candidate_id, resume_type);

-- Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portfolios_candidate ON portfolios(candidate_id);

-- Resume parse logs for tracking async parse operations
CREATE TABLE IF NOT EXISTS resume_parse_logs (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  parse_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_parse_logs_resume ON resume_parse_logs(resume_id);
CREATE INDEX IF NOT EXISTS idx_parse_logs_status ON resume_parse_logs(status);
