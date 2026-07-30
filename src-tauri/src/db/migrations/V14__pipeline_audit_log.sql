-- V14: Pipeline audit log for tracking key events in candidate pipeline lifecycle.
-- Records enter_job, leave_job, reject, pool actions (NOT stage transitions).

CREATE TABLE IF NOT EXISTS pipeline_audit_log (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    pipeline_id TEXT NOT NULL,
    job_id TEXT,
    action TEXT NOT NULL CHECK(action IN ('enter_job', 'leave_job', 'reject', 'pool')),
    action_detail TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_candidate ON pipeline_audit_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON pipeline_audit_log(created_at);
