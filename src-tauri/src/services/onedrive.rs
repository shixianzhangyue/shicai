use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// OneDrive API base URL.
const GRAPH_API_BASE: &str = "https://graph.microsoft.com/v1.0";

/// Microsoft OAuth2 endpoints.
const OAUTH_AUTHORIZE_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OAUTH_TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

/// Required Microsoft Graph permissions for file sync.
const REQUIRED_SCOPES: &str = "files.readwrite offline_access user.read";

/// Microsoft Graph application client ID.
/// This is a placeholder — replace with your registered Azure AD app client ID.
const CLIENT_ID: &str = "YOUR_AZURE_CLIENT_ID";

/// Sync configuration stored in DB.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    pub id: String,
    pub provider: String,
    pub sync_enabled: bool,
    pub last_sync_at: Option<String>,
    pub sync_path: String,
    pub token_expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Sync log entry for tracking upload/download history.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncLogEntry {
    pub id: String,
    pub file_type: String,
    pub local_path: String,
    pub cloud_path: String,
    pub sync_status: String,
    pub error_message: Option<String>,
    pub file_size: Option<i64>,
    pub synced_at: Option<String>,
    pub created_at: String,
}

/// OAuth2 authorization URL for OneDrive login.
pub fn build_auth_url(redirect_uri: &str) -> String {
    format!(
        "{}?client_id={}&response_type=code&redirect_uri={}&scope={}&response_mode=query",
        OAUTH_AUTHORIZE_URL, CLIENT_ID, redirect_uri, REQUIRED_SCOPES
    )
}

/// Exchanges an authorization code for access and refresh tokens.
/// Returns (access_token, refresh_token, expires_in_seconds).
pub fn exchange_code(code: &str, redirect_uri: &str) -> Result<(String, String, i64), String> {
    let client = reqwest::blocking::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("scope", REQUIRED_SCOPES),
    ];

    let resp = client
        .post(OAUTH_TOKEN_URL)
        .form(&params)
        .send()
        .map_err(|e| format!("Token request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("Token exchange failed ({}): {}", status, body));
    }

    let token_resp: serde_json::Value = resp
        .json()
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = token_resp["access_token"]
        .as_str()
        .ok_or("Missing access_token")?
        .to_string();
    let refresh_token = token_resp["refresh_token"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let expires_in = token_resp["expires_in"].as_i64().unwrap_or(3600);

    Ok((access_token, refresh_token, expires_in))
}

/// Refreshes an expired access token using the stored refresh token.
pub fn refresh_access_token(refresh_token: &str) -> Result<(String, i64), String> {
    let client = reqwest::blocking::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("scope", REQUIRED_SCOPES),
    ];

    let resp = client
        .post(OAUTH_TOKEN_URL)
        .form(&params)
        .send()
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("Token refresh failed ({}): {}", status, body));
    }

    let token_resp: serde_json::Value = resp
        .json()
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    let access_token = token_resp["access_token"]
        .as_str()
        .ok_or("Missing access_token in refresh response")?
        .to_string();
    let expires_in = token_resp["expires_in"].as_i64().unwrap_or(3600);

    Ok((access_token, expires_in))
}

/// Checks if the current access token is still valid.
pub fn is_token_valid(config: &SyncConfig) -> bool {
    if !config.sync_enabled {
        return false;
    }
    if let Some(ref expires) = config.token_expires_at {
        if let Ok(exp_time) = chrono::DateTime::parse_from_rfc3339(expires) {
            return exp_time > chrono::Utc::now();
        }
    }
    false
}

/// Uploads a local file to OneDrive.
pub fn upload_file(
    access_token: &str,
    local_path: &PathBuf,
    cloud_path: &str,
) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/me/drive/root:{}:/content", GRAPH_API_BASE, cloud_path);

    let file_bytes = std::fs::read(local_path)
        .map_err(|e| format!("Failed to read local file {}: {}", local_path.display(), e))?;

    let resp = client
        .put(&url)
        .bearer_auth(access_token)
        .header("Content-Type", "application/octet-stream")
        .body(file_bytes)
        .send()
        .map_err(|e| format!("Upload request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("Upload failed ({}): {}", status, body));
    }

    let result: serde_json::Value = resp
        .json()
        .map_err(|e| format!("Failed to parse upload response: {}", e))?;

    let web_url = result["webUrl"]
        .as_str()
        .unwrap_or(cloud_path)
        .to_string();

    Ok(web_url)
}

/// Downloads a file from OneDrive to a local path.
pub fn download_file(
    access_token: &str,
    cloud_path: &str,
    local_path: &PathBuf,
) -> Result<i64, String> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/me/drive/root:{}:/content", GRAPH_API_BASE, cloud_path);

    let resp = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("Download failed ({}): {}", status, body));
    }

    let bytes = resp
        .bytes()
        .map_err(|e| format!("Failed to read download bytes: {}", e))?;

    let size = bytes.len() as i64;
    std::fs::write(local_path, &bytes)
        .map_err(|e| format!("Failed to write local file {}: {}", local_path.display(), e))?;

    Ok(size)
}

/// Lists files in a OneDrive folder.
pub fn list_cloud_files(
    access_token: &str,
    cloud_path: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/me/drive/root:{}/children", GRAPH_API_BASE, cloud_path);

    let resp = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .map_err(|e| format!("List request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("List files failed ({}): {}", status, body));
    }

    let result: serde_json::Value = resp
        .json()
        .map_err(|e| format!("Failed to parse list response: {}", e))?;

    let items = result["value"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    Ok(items)
}

/// Deletes a file from OneDrive.
pub fn delete_cloud_file(access_token: &str, cloud_path: &str) -> Result<(), String> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/me/drive/root:{}:", GRAPH_API_BASE, cloud_path);

    let resp = client
        .delete(&url)
        .bearer_auth(access_token)
        .send()
        .map_err(|e| format!("Delete request failed: {}", e))?;

    let resp_status = resp.status();
    if !resp_status.is_success() && resp_status.as_u16() != 404 {
        let body = resp.text().unwrap_or_default();
        return Err(format!("Delete failed ({}): {}", resp_status, body));
    }

    Ok(())
}

/// Saves sync configuration to the database.
pub fn save_sync_config(pool: &DbPool, config: &SyncConfig) -> Result<(), String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO cloud_sync_config (id, provider, access_token, refresh_token, token_expires_at, sync_enabled, last_sync_at, sync_path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &config.id,
            &config.provider,
            "", // access_token is not exposed in the struct
            "", // refresh_token is not exposed
            &config.token_expires_at,
            config.sync_enabled as i32,
            &config.last_sync_at,
            &config.sync_path,
            &config.created_at,
            &config.updated_at,
        ],
    )
    .map_err(|e| format!("Failed to save sync config: {}", e))?;

    Ok(())
}

/// Records a sync log entry.
pub fn record_sync_log(
    pool: &DbPool,
    file_type: &str,
    local_path: &str,
    cloud_path: &str,
    status: &str,
    error_message: Option<&str>,
    file_size: Option<i64>,
) -> Result<String, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;
    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();
    let synced_at = if status == "success" {
        Some(now.clone())
    } else {
        None
    };

    conn.execute(
        "INSERT INTO cloud_sync_log (id, file_type, local_path, cloud_path, sync_status, error_message, file_size, synced_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            file_type,
            local_path,
            cloud_path,
            status,
            error_message,
            file_size,
            synced_at,
            &now,
        ],
    )
    .map_err(|e| format!("Failed to record sync log: {}", e))?;

    Ok(id)
}

/// Retrieves sync log entries with pagination.
pub fn get_sync_logs(
    pool: &DbPool,
    limit: i32,
    offset: i32,
) -> Result<Vec<SyncLogEntry>, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, file_type, local_path, cloud_path, sync_status, error_message, file_size, synced_at, created_at FROM cloud_sync_log ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| format!("Failed to prepare sync log query: {}", e))?;

    let entries = stmt
        .query_map(params![limit, offset], |row| {
            Ok(SyncLogEntry {
                id: row.get(0)?,
                file_type: row.get(1)?,
                local_path: row.get(2)?,
                cloud_path: row.get(3)?,
                sync_status: row.get(4)?,
                error_message: row.get(5)?,
                file_size: row.get(6)?,
                synced_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to execute sync log query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect sync logs: {}", e))?;

    Ok(entries)
}
