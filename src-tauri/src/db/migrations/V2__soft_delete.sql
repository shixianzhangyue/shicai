-- V2: Add audit logs table for soft-delete tracking
-- Note: deleted_at columns were already added in V1__init.sql for jobs and candidates.
-- This migration focuses on creating the audit_logs table required by the soft-delete spec.

-- Audit logs table: records soft_delete, restore, and hard_delete actions
-- with a JSON snapshot of the record before deletion.
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,                -- jobs | candidates
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,                    -- soft_delete | restore | hard_delete
  old_data TEXT,                           -- JSON snapshot of the record before action
  performed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_logs(table_name, record_id);
