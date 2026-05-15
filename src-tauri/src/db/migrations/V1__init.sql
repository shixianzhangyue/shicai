-- Initial schema for TalentVault

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT,
  salary_min REAL,
  salary_max REAL,
  description TEXT,
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  tags TEXT DEFAULT '[]',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  current_company TEXT,
  current_position TEXT,
  education TEXT,
  years_exp INTEGER,
  source TEXT DEFAULT 'manual',
  tags TEXT DEFAULT '[]',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candidates_deleted_at ON candidates(deleted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(name);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  parsed_data TEXT,
  uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON resumes(candidate_id);

-- Pipeline stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_default INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stages_job ON pipeline_stages(job_id);

-- Candidate pipeline table
CREATE TABLE IF NOT EXISTS candidate_pipeline (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  current_stage_id TEXT REFERENCES pipeline_stages(id),
  status TEXT NOT NULL DEFAULT 'active',
  entered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_candidate ON candidate_pipeline(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_job ON candidate_pipeline(job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON candidate_pipeline(current_stage_id);

-- Follow-ups table
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  content TEXT NOT NULL,
  follow_type TEXT DEFAULT 'other',
  result TEXT,
  next_follow_date TEXT,
  related_job_id TEXT REFERENCES jobs(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_followups_candidate ON follow_ups(candidate_id);
CREATE INDEX IF NOT EXISTS idx_followups_next_date ON follow_ups(next_follow_date);

-- Candidate relations table
CREATE TABLE IF NOT EXISTS candidate_relations (
  id TEXT PRIMARY KEY,
  candidate_id_a TEXT NOT NULL REFERENCES candidates(id),
  candidate_id_b TEXT NOT NULL REFERENCES candidates(id),
  relation_type TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relations_a ON candidate_relations(candidate_id_a);
CREATE INDEX IF NOT EXISTS idx_relations_b ON candidate_relations(candidate_id_b);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3b82f6',
  created_at TEXT NOT NULL
);

-- Job templates table
CREATE TABLE IF NOT EXISTS job_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Stats cache table
CREATE TABLE IF NOT EXISTS stats_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
