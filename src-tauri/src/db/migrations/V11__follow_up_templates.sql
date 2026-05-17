-- V11: Follow-up templates and enhanced follow-up tracking

-- Follow-up templates for standardized follow-up workflows
CREATE TABLE IF NOT EXISTS follow_up_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  default_interval_days INTEGER NOT NULL DEFAULT 7,
  stage_trigger TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_follow_up_templates_active ON follow_up_templates(is_active) WHERE is_active = 1;

-- Add template_id and status to follow_ups for template-based follow-ups
ALTER TABLE follow_ups ADD COLUMN template_id TEXT REFERENCES follow_up_templates(id);
ALTER TABLE follow_ups ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE follow_ups ADD COLUMN scheduled_date TEXT;

CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON follow_ups(scheduled_date);
