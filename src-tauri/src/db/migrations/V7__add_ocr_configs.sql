CREATE TABLE IF NOT EXISTS ocr_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL DEFAULT 'baidu',
    api_key TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS ocr_configs_updated_at
AFTER UPDATE ON ocr_configs
FOR EACH ROW
BEGIN
    UPDATE ocr_configs SET updated_at = datetime('now') WHERE id = NEW.id;
END;