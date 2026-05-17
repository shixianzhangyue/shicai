-- V12: Candidate module enhancement for talent-candidate separation
-- Adds avatar_url, age, last_active_at to candidates table
-- Adds interview_conclusion, interview_notes, applied_at to candidate_pipeline table
-- Adds performance indexes for candidate module queries

-- Candidates table enhancements
ALTER TABLE candidates ADD COLUMN avatar_url TEXT;
ALTER TABLE candidates ADD COLUMN age INTEGER;
ALTER TABLE candidates ADD COLUMN last_active_at TEXT;

-- Candidate pipeline table enhancements
ALTER TABLE candidate_pipeline ADD COLUMN interview_conclusion TEXT;
ALTER TABLE candidate_pipeline ADD COLUMN interview_notes TEXT;
ALTER TABLE candidate_pipeline ADD COLUMN applied_at TEXT;

-- Performance indexes for candidate module queries
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_job ON candidate_pipeline(job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_stage ON candidate_pipeline(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_status ON candidate_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_applied ON candidate_pipeline(applied_at);

-- Index for talent pool queries
CREATE INDEX IF NOT EXISTS idx_candidates_last_active ON candidates(last_active_at);

-- Update existing records with default values
UPDATE candidates SET last_active_at = created_at WHERE last_active_at IS NULL;
UPDATE candidate_pipeline SET applied_at = entered_at WHERE applied_at IS NULL;