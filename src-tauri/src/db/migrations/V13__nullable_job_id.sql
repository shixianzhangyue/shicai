-- V13: Allow nullable job_id in candidate_pipeline for talent pool entries
-- When a candidate is added to the talent pool directly (not via a specific job),
-- job_id should be NULL to indicate they are not tied to any position.

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table.
-- First, create a new table with the corrected schema.
CREATE TABLE IF NOT EXISTS candidate_pipeline_new (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  job_id TEXT REFERENCES jobs(id),
  current_stage_id TEXT REFERENCES pipeline_stages(id),
  status TEXT NOT NULL DEFAULT 'active',
  entered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  interview_conclusion TEXT,
  interview_notes TEXT,
  applied_at TEXT
);

-- Copy existing data
INSERT INTO candidate_pipeline_new (id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at, interview_conclusion, interview_notes, applied_at)
SELECT id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at, interview_conclusion, interview_notes, applied_at
FROM candidate_pipeline;

-- Drop old table
DROP TABLE candidate_pipeline;

-- Rename new table
ALTER TABLE candidate_pipeline_new RENAME TO candidate_pipeline;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_candidate ON candidate_pipeline(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_job ON candidate_pipeline(job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON candidate_pipeline(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_job_stage ON candidate_pipeline(job_id, current_stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_status ON candidate_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_applied ON candidate_pipeline(applied_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_last_active ON candidate_pipeline(updated_at);
