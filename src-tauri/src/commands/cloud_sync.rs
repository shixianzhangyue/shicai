use crate::db::pool::DbPool;
use crate::services::onedrive;
use chrono::Local;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// OneDrive sync configuration exposed to the frontend.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusResponse {
    pub sync_enabled: bool,
    pub last_sync_at: Option<String>,
    pub sync_path: String,
    pub token_valid: bool,
    pub provider: String,
}

/// OAuth callback result returned to frontend after completing authorization.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthResult {
    pub success: bool,
    pub message: String,
}

/// Starts the OAuth2 authorization flow by returning the login URL.
/// The frontend should open this URL in the user's browser.
#[tauri::command]
pub fn init_onedrive_oauth() -> Result<String, String> {
    let redirect_uri = "http://localhost:8080/callback";
    let auth_url = onedrive::build_auth_url(redirect_uri);
    Ok(auth_url)
}

/// Completes the OAuth2 flow by exchanging the authorization code for tokens.
#[tauri::command]
pub fn complete_onedrive_oauth(
    state: tauri::State<DbPool>,
    code: String,
) -> Result<OAuthResult, String> {
    let redirect_uri = "http://localhost:8080/callback";

    let (access_token, refresh_token, expires_in) =
        onedrive::exchange_code(&code, redirect_uri)?;

    let conn = state.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let config_id = "onedrive_default";
    let now = Local::now().to_rfc3339();
    let expires_at = (Local::now() + chrono::Duration::seconds(expires_in)).to_rfc3339();

    // Upsert sync config
    conn.execute(
        "INSERT OR REPLACE INTO cloud_sync_config (id, provider, access_token, refresh_token, token_expires_at, sync_enabled, sync_path, created_at, updated_at) VALUES (?1, 'onedrive', ?2, ?3, ?4, 1, '/TalentVault', ?5, ?5)",
        params![config_id, &access_token, &refresh_token, &expires_at, &now],
    )
    .map_err(|e| format!("Failed to save OAuth tokens: {}", e))?;

    log::info!("OneDrive OAuth completed successfully");

    Ok(OAuthResult {
        success: true,
        message: "OneDrive 账户授权成功".to_string(),
    })
}

/// Returns the current OneDrive sync status.
#[tauri::command]
pub fn get_sync_status(state: tauri::State<DbPool>) -> Result<SyncStatusResponse, String> {
    let conn = state.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let result = conn.query_row(
        "SELECT id, provider, sync_enabled, last_sync_at, sync_path, token_expires_at FROM cloud_sync_config WHERE id = 'onedrive_default'",
        [],
        |row| {
            let sync_enabled: i32 = row.get(2)?;
            let token_expires_at: Option<String> = row.get(5)?;
            let token_valid = if let Some(ref expires) = token_expires_at {
                chrono::DateTime::parse_from_rfc3339(expires)
                    .map(|t| t > chrono::Utc::now())
                    .unwrap_or(false)
            } else {
                false
            };
            Ok(SyncStatusResponse {
                sync_enabled: sync_enabled != 0,
                last_sync_at: row.get(3)?,
                sync_path: row.get(4)?,
                token_valid,
                provider: row.get(1)?,
            })
        },
    );

    match result {
        Ok(status) => Ok(status),
        Err(_) => Ok(SyncStatusResponse {
            sync_enabled: false,
            last_sync_at: None,
            sync_path: "/TalentVault".to_string(),
            token_valid: false,
            provider: "onedrive".to_string(),
        }),
    }
}

/// Syncs local backup to OneDrive cloud.
#[tauri::command]
pub fn sync_to_cloud(
    state: tauri::State<DbPool>,
    local_file_path: String,
    cloud_file_name: Option<String>,
) -> Result<String, String> {
    let conn = state.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    // Get access token
    let config = conn.query_row(
        "SELECT access_token, refresh_token, token_expires_at, sync_enabled, sync_path FROM cloud_sync_config WHERE id = 'onedrive_default'",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i32>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        },
    ).map_err(|_| "OneDrive 未授权，请先完成 OAuth 授权".to_string())?;

    if config.3 == 0 {
        return Err("OneDrive 同步未启用".to_string());
    }

    let mut access_token = config.0.unwrap_or_default();

    // Check token validity and refresh if needed
    if let Some(ref expires) = config.2 {
        if let Ok(exp_time) = chrono::DateTime::parse_from_rfc3339(expires) {
            if exp_time <= chrono::Utc::now() {
                // Token expired, try refresh
                if let Some(ref refresh) = config.1 {
                    let (new_token, new_expires_in) = onedrive::refresh_access_token(refresh)?;
                    let new_expires_at =
                        (Local::now() + chrono::Duration::seconds(new_expires_in)).to_rfc3339();
                    let now = Local::now().to_rfc3339();

                    conn.execute(
                        "UPDATE cloud_sync_config SET access_token = ?1, token_expires_at = ?2, updated_at = ?3 WHERE id = 'onedrive_default'",
                        params![&new_token, &new_expires_at, &now],
                    )
                    .map_err(|e| format!("Failed to update refreshed token: {}", e))?;

                    access_token = new_token;
                }
            }
        }
    }

    let sync_path = config.4.unwrap_or_else(|| "/TalentVault".to_string());
    let file_name = cloud_file_name.unwrap_or_else(|| {
        std::path::Path::new(&local_file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("backup.zip")
            .to_string()
    });
    let cloud_path = format!("{}/{}", sync_path, file_name);
    let local_path = std::path::PathBuf::from(&local_file_path);

    // Upload file
    let result = onedrive::upload_file(&access_token, &local_path, &cloud_path);

    let file_size = std::fs::metadata(&local_path)
        .map(|m| m.len() as i64)
        .ok();

    match result {
        Ok(web_url) => {
            // Record success
            let _ = onedrive::record_sync_log(
                &state,
                "backup",
                &local_file_path,
                &cloud_path,
                "success",
                None,
                file_size,
            );

            // Update last sync time
            let now = Local::now().to_rfc3339();
            let _ = conn.execute(
                "UPDATE cloud_sync_config SET last_sync_at = ?1 WHERE id = 'onedrive_default'",
                params![&now],
            );

            log::info!("Synced {} to OneDrive: {}", local_file_path, cloud_path);
            Ok(web_url)
        }
        Err(e) => {
            let _ = onedrive::record_sync_log(
                &state,
                "backup",
                &local_file_path,
                &cloud_path,
                "failed",
                Some(&e),
                file_size,
            );
            Err(format!("同步失败: {}", e))
        }
    }
}

/// Downloads a file from OneDrive to local path.
#[tauri::command]
pub fn sync_from_cloud(
    state: tauri::State<DbPool>,
    cloud_file_path: String,
    local_file_path: String,
) -> Result<String, String> {
    let conn = state.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let config = conn.query_row(
        "SELECT access_token, refresh_token, token_expires_at FROM cloud_sync_config WHERE id = 'onedrive_default' AND sync_enabled = 1",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        },
    ).map_err(|_| "OneDrive 未授权或未启用同步".to_string())?;

    let mut access_token = config.0.unwrap_or_default();

    // Check and refresh token if needed
    if let Some(ref expires) = config.2 {
        if let Ok(exp_time) = chrono::DateTime::parse_from_rfc3339(expires) {
            if exp_time <= chrono::Utc::now() {
                if let Some(ref refresh) = config.1 {
                    let (new_token, new_expires_in) = onedrive::refresh_access_token(refresh)?;
                    let new_expires_at =
                        (Local::now() + chrono::Duration::seconds(new_expires_in)).to_rfc3339();
                    let now = Local::now().to_rfc3339();

                    conn.execute(
                        "UPDATE cloud_sync_config SET access_token = ?1, token_expires_at = ?2, updated_at = ?3 WHERE id = 'onedrive_default'",
                        params![&new_token, &new_expires_at, &now],
                    )
                    .map_err(|e| format!("Failed to update refreshed token: {}", e))?;

                    access_token = new_token;
                }
            }
        }
    }

    let local_path = std::path::PathBuf::from(&local_file_path);

    match onedrive::download_file(&access_token, &cloud_file_path, &local_path) {
        Ok(size) => {
            let _ = onedrive::record_sync_log(
                &state,
                "restore",
                &local_file_path,
                &cloud_file_path,
                "success",
                None,
                Some(size),
            );

            log::info!("Downloaded {} from OneDrive to {}", cloud_file_path, local_file_path);
            Ok(local_file_path)
        }
        Err(e) => {
            let _ = onedrive::record_sync_log(
                &state,
                "restore",
                &local_file_path,
                &cloud_file_path,
                "failed",
                Some(&e),
                None,
            );
            Err(format!("从云端下载失败: {}", e))
        }
    }
}

/// Retrieves the sync operation history with pagination.
#[tauri::command]
pub fn get_sync_log(
    state: tauri::State<DbPool>,
    page: Option<i32>,
    page_size: Option<i32>,
) -> Result<Vec<crate::services::onedrive::SyncLogEntry>, String> {
    let current_page = page.unwrap_or(1).max(1);
    let size = page_size.unwrap_or(20).max(1).min(100);
    let offset = (current_page - 1) * size;

    onedrive::get_sync_logs(&state, size, offset)
}

/// Configures the OneDrive sync settings.
#[tauri::command]
pub fn configure_sync(
    state: tauri::State<DbPool>,
    sync_enabled: Option<bool>,
    sync_path: Option<String>,
) -> Result<SyncStatusResponse, String> {
    let conn = state.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let now = Local::now().to_rfc3339();

    if let Some(enabled) = sync_enabled {
        conn.execute(
            "UPDATE cloud_sync_config SET sync_enabled = ?1, updated_at = ?2 WHERE id = 'onedrive_default'",
            params![enabled as i32, &now],
        )
        .map_err(|e| format!("Failed to update sync enabled: {}", e))?;
    }

    if let Some(ref path) = sync_path {
        conn.execute(
            "UPDATE cloud_sync_config SET sync_path = ?1, updated_at = ?2 WHERE id = 'onedrive_default'",
            params![path, &now],
        )
        .map_err(|e| format!("Failed to update sync path: {}", e))?;
    }

    get_sync_status(state)
}
