CREATE TABLE IF NOT EXISTS pipeline_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stages_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_templates_created_at ON pipeline_templates(created_at);
