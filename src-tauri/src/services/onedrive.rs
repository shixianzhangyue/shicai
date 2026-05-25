use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// OneDrive API base URL.
const GRAPH_API_BASE: &str = "https://graph.microsoft.com/v1.0";

/// Microsoft OAuth2 token endpoint.
const OAUTH_TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

/// Required Microsoft Graph permissions for file sync.
const REQUIRED_SCOPES: &str = "files.readwrite offline_access user.read";

/// Microsoft Graph application client ID.
/// This is a placeholder — replace with your registered Azure AD app client ID.
const CLIENT_ID: &str = "YOUR_AZURE_CLIENT_ID";

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