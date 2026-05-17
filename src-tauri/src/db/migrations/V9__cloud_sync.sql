-- V9: OneDrive cloud sync configuration and logging

CREATE TABLE IF NOT EXISTS cloud_sync_config (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'onedrive',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  sync_enabled INTEGER DEFAULT 0,
  last_sync_at TEXT,
  sync_path TEXT DEFAULT '/TalentVault',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS cloud_sync_config_updated_at
AFTER UPDATE ON cloud_sync_config
FOR EACH ROW
BEGIN
    UPDATE cloud_sync_config SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS cloud_sync_log (
  id TEXT PRIMARY KEY,
  file_type TEXT NOT NULL,
  local_path TEXT NOT NULL,
  cloud_path TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  file_size INTEGER,
  synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_status ON cloud_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON cloud_sync_log(file_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON cloud_sync_log(created_at);
