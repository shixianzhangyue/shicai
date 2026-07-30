-- V17: Extend cloud_sync_config for multi-provider support
-- Add fields for WebDAV and S3 compatible storage

ALTER TABLE cloud_sync_config ADD COLUMN server_url TEXT;
ALTER TABLE cloud_sync_config ADD COLUMN bucket TEXT;
ALTER TABLE cloud_sync_config ADD COLUMN region TEXT;
ALTER TABLE cloud_sync_config ADD COLUMN username TEXT;
ALTER TABLE cloud_sync_config ADD COLUMN password TEXT;

-- Add provider column to cloud_sync_log for filtering by provider
ALTER TABLE cloud_sync_log ADD COLUMN provider TEXT DEFAULT 'onedrive';
