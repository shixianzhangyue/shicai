use crate::db::pool::DbPool;
use crate::services::onedrive;
use crate::services::llm_client::{obfuscate_key, deobfuscate_key};
use chrono::Local;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use nanoid;

/// Cloud provider types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CloudProvider {
    Baidu,
    Onedrive,
    Nutstore,
    Webdav,
    S3,
}

impl CloudProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            CloudProvider::Baidu => "baidu",
            CloudProvider::Onedrive => "onedrive",
            CloudProvider::Nutstore => "nutstore",
            CloudProvider::Webdav => "webdav",
            CloudProvider::S3 => "s3",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CloudProvider::Baidu => "百度网盘",
            CloudProvider::Onedrive => "OneDrive",
            CloudProvider::Nutstore => "坚果云",
            CloudProvider::Webdav => "WebDAV",
            CloudProvider::S3 => "S3 兼容存储",
        }
    }
}

/// Cloud sync configuration for a single provider
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudConfig {
    pub provider: String,
    pub sync_enabled: bool,
    pub last_sync_at: Option<String>,
    pub sync_path: String,
    pub token_valid: bool,
    pub server_url: Option<String>,
    pub bucket: Option<String>,
    pub region: Option<String>,
    pub username: Option<String>,
    // password is NOT returned for security
}

/// Input for saving cloud config
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCloudConfigInput {
    pub provider: String,
    pub sync_enabled: Option<bool>,
    pub sync_path: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<String>,
    pub server_url: Option<String>,
    pub bucket: Option<String>,
    pub region: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// OAuth callback result
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthResult {
    pub success: bool,
    pub message: String,
}

/// Sync log entry
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncLogEntry {
    pub id: String,
    pub provider: String,
    pub file_type: String,
    pub local_path: String,
    pub cloud_path: String,
    pub sync_status: String,
    pub error_message: Option<String>,
    pub file_size: Option<i64>,
    pub synced_at: Option<String>,
    pub created_at: String,
}

/// Returns status of all configured cloud providers
#[tauri::command]
pub fn get_all_sync_status(state: tauri::State<DbPool>) -> Result<Vec<CloudConfig>, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT provider, sync_enabled, last_sync_at, sync_path, token_expires_at,
                    server_url, bucket, region, username
             FROM cloud_sync_config ORDER BY provider",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let configs = stmt
        .query_map([], |row| {
            let provider: String = row.get(0)?;
            let sync_enabled: i32 = row.get(1)?;
            let token_expires_at: Option<String> = row.get(4)?;

            let token_valid = match provider.as_str() {
                "onedrive" => {
                    if let Some(ref expires) = token_expires_at {
                        chrono::DateTime::parse_from_rfc3339(expires)
                            .map(|t| t > chrono::Utc::now())
                            .unwrap_or(false)
                    } else {
                        false
                    }
                }
                // For non-OAuth providers, token_valid = has password/key
                _ => {
                    let has_password: Option<String> = row.get(8)?;
                    has_password.is_some() && !has_password.unwrap_or_default().is_empty()
                }
            };

            Ok(CloudConfig {
                provider,
                sync_enabled: sync_enabled != 0,
                last_sync_at: row.get(2)?,
                sync_path: row.get(3)?,
                token_valid,
                server_url: row.get(5)?,
                bucket: row.get(6)?,
                region: row.get(7)?,
                username: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query configs: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect configs: {}", e))?;

    Ok(configs)
}

/// Saves or updates cloud config for a provider
/// SECURITY: Encrypts sensitive credentials (access_token, refresh_token, password) before storage
#[tauri::command]
pub fn save_cloud_config(
    state: tauri::State<DbPool>,
    input: SaveCloudConfigInput,
) -> Result<CloudConfig, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;
    let now = Local::now().to_rfc3339();

    // Encrypt sensitive fields before storing
    let encrypted_access_token = input.access_token.as_deref().map(obfuscate_key);
    let encrypted_refresh_token = input.refresh_token.as_deref().map(obfuscate_key);
    let encrypted_password = input.password.as_deref().map(obfuscate_key);

    // Upsert: INSERT OR REPLACE with provider as id
    conn.execute(
        "INSERT INTO cloud_sync_config (id, provider, access_token, refresh_token, token_expires_at, sync_enabled, sync_path, server_url, bucket, region, username, password, created_at, updated_at)
         VALUES (?1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
         ON CONFLICT(id) DO UPDATE SET
           access_token = COALESCE(?2, access_token),
           refresh_token = COALESCE(?3, refresh_token),
           token_expires_at = COALESCE(?4, token_expires_at),
           sync_enabled = COALESCE(?5, sync_enabled),
           sync_path = COALESCE(?6, sync_path),
           server_url = COALESCE(?7, server_url),
           bucket = COALESCE(?8, bucket),
           region = COALESCE(?9, region),
           username = COALESCE(?10, username),
           password = COALESCE(?11, password),
           updated_at = ?12",
        params![
            &input.provider,
            &encrypted_access_token,
            &encrypted_refresh_token,
            &input.token_expires_at,
            input.sync_enabled.unwrap_or(true) as i32,
            input.sync_path.as_deref().unwrap_or("/Shicore"),
            &input.server_url,
            &input.bucket,
            &input.region,
            &input.username,
            &encrypted_password,
            &now,
        ],
    )
    .map_err(|e| format!("Failed to save config: {}", e))?;

    // Return the saved config
    get_cloud_config(state, input.provider)
}

/// Returns config for a single provider
#[tauri::command]
pub fn get_cloud_config(
    state: tauri::State<DbPool>,
    provider: String,
) -> Result<CloudConfig, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;

    conn.query_row(
        "SELECT provider, sync_enabled, last_sync_at, sync_path, token_expires_at,
                server_url, bucket, region, username
         FROM cloud_sync_config WHERE id = ?1",
        params![&provider],
        |row| {
            let provider: String = row.get(0)?;
            let sync_enabled: i32 = row.get(1)?;
            let token_expires_at: Option<String> = row.get(4)?;

            let token_valid = if provider == "onedrive" {
                if let Some(ref expires) = token_expires_at {
                    chrono::DateTime::parse_from_rfc3339(expires)
                        .map(|t| t > chrono::Utc::now())
                        .unwrap_or(false)
                } else {
                    false
                }
            } else {
                true // Non-OAuth providers don't expire
            };

            Ok(CloudConfig {
                provider,
                sync_enabled: sync_enabled != 0,
                last_sync_at: row.get(2)?,
                sync_path: row.get(3)?,
                token_valid,
                server_url: row.get(5)?,
                bucket: row.get(6)?,
                region: row.get(7)?,
                username: row.get(8)?,
            })
        },
    )
    .map_err(|_| format!("Provider '{}' not configured", provider))
}

/// Starts OneDrive OAuth flow
#[tauri::command]
pub fn init_onedrive_oauth() -> Result<String, String> {
    let redirect_uri = "http://localhost:8080/callback";
    let auth_url = onedrive::build_auth_url(redirect_uri);
    Ok(auth_url)
}

/// Completes OneDrive OAuth flow
/// SECURITY: Encrypts OAuth tokens before storage
#[tauri::command]
pub fn complete_onedrive_oauth(
    state: tauri::State<DbPool>,
    code: String,
) -> Result<OAuthResult, String> {
    let redirect_uri = "http://localhost:8080/callback";
    let (access_token, refresh_token, expires_in) =
        onedrive::exchange_code(&code, redirect_uri)?;

    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;
    let now = Local::now().to_rfc3339();
    let expires_at = (Local::now() + chrono::Duration::seconds(expires_in)).to_rfc3339();

    // Encrypt tokens before storing
    let encrypted_access_token = obfuscate_key(&access_token);
    let encrypted_refresh_token = obfuscate_key(&refresh_token);

    conn.execute(
        "INSERT INTO cloud_sync_config (id, provider, access_token, refresh_token, token_expires_at, sync_enabled, sync_path, created_at, updated_at)
         VALUES ('onedrive', 'onedrive', ?1, ?2, ?3, 1, '/Shicore', ?4, ?4)
         ON CONFLICT(id) DO UPDATE SET
           access_token = ?1, refresh_token = ?2, token_expires_at = ?3, sync_enabled = 1, updated_at = ?4",
        params![&encrypted_access_token, &encrypted_refresh_token, &expires_at, &now],
    )
    .map_err(|e| format!("Failed to save OAuth tokens: {}", e))?;

    Ok(OAuthResult {
        success: true,
        message: "OneDrive 账户授权成功".to_string(),
    })
}

/// Tests connection for a provider
#[tauri::command]
pub fn test_cloud_connection(
    state: tauri::State<DbPool>,
    provider: String,
) -> Result<String, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;

    let config = conn
        .query_row(
            "SELECT access_token, server_url, bucket, region, username, password
             FROM cloud_sync_config WHERE id = ?1",
            params![&provider],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .map_err(|_| format!("Provider '{}' not configured", provider))?;

    match provider.as_str() {
        "onedrive" => {
            if config.0.is_some() && !config.0.unwrap_or_default().is_empty() {
                Ok("OneDrive 连接正常".to_string())
            } else {
                Err("OneDrive 未授权".to_string())
            }
        }
        "nutstore" | "webdav" => {
            let url = config.1.ok_or("缺少服务器地址")?;
            let username = config.4.ok_or("缺少用户名")?;
            let encrypted_password = config.5.ok_or("缺少密码")?;
            let password = deobfuscate_key(&encrypted_password);
            test_webdav_connection(&url, &username, &password)
        }
        "s3" => {
            let bucket = config.2.ok_or("缺少 Bucket 名称")?;
            let region = config.3.unwrap_or_else(|| "us-east-1".to_string());
            let encrypted_access_key = config.0.ok_or("缺少 Access Key")?;
            let access_key = deobfuscate_key(&encrypted_access_key);
            let encrypted_secret_key = config.5.unwrap_or_default();
            let secret_key = deobfuscate_key(&encrypted_secret_key);
            test_s3_connection(&bucket, &region, &access_key, &secret_key)
        }
        "baidu" => {
            if config.0.is_some() && !config.0.unwrap_or_default().is_empty() {
                Ok("百度网盘连接正常".to_string())
            } else {
                Err("百度网盘未授权".to_string())
            }
        }
        _ => Err(format!("不支持的 provider: {}", provider)),
    }
}

/// Syncs a local file to the specified cloud provider
#[tauri::command]
pub fn sync_to_cloud(
    state: tauri::State<DbPool>,
    provider: String,
    local_file_path: String,
    cloud_file_name: Option<String>,
) -> Result<String, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;

    let config = conn
        .query_row(
            "SELECT access_token, refresh_token, token_expires_at, sync_enabled, sync_path,
                    server_url, bucket, region, username, password
             FROM cloud_sync_config WHERE id = ?1",
            params![&provider],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, i32>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<String>>(9)?,
                ))
            },
        )
        .map_err(|_| format!("Provider '{}' not configured", provider))?;

    if config.3 == 0 {
        return Err(format!("{} 同步未启用", provider));
    }

    let sync_path = config.4.unwrap_or_else(|| "/Shicore".to_string());
    let file_name = cloud_file_name.unwrap_or_else(|| {
        std::path::Path::new(&local_file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("backup.zip")
            .to_string()
    });
    let cloud_path = format!("{}/{}", sync_path, file_name);
    let local_path = std::path::PathBuf::from(&local_file_path);

    let result: Result<String, String> = match provider.as_str() {
        "onedrive" => {
            let mut access_token = deobfuscate_key(&config.0.unwrap_or_default());
            // Refresh token if needed
            if let Some(ref expires) = config.2 {
                if let Ok(exp_time) = chrono::DateTime::parse_from_rfc3339(expires) {
                    if exp_time <= chrono::Utc::now() {
                        if let Some(ref refresh) = config.1 {
                            let decrypted_refresh = deobfuscate_key(refresh);
                            let (new_token, new_expires_in) =
                                onedrive::refresh_access_token(&decrypted_refresh)?;
                            let new_expires_at = (Local::now()
                                + chrono::Duration::seconds(new_expires_in))
                            .to_rfc3339();
                            let now = Local::now().to_rfc3339();
                            let encrypted_new_token = obfuscate_key(&new_token);
                            let _ = conn.execute(
                                "UPDATE cloud_sync_config SET access_token = ?1, token_expires_at = ?2, updated_at = ?3 WHERE id = 'onedrive'",
                                params![&encrypted_new_token, &new_expires_at, &now],
                            );
                            access_token = new_token;
                        }
                    }
                }
            }
            onedrive::upload_file(&access_token, &local_path, &cloud_path)
        }
        "nutstore" | "webdav" => {
            let url = config.5.ok_or("缺少服务器地址")?;
            let username = config.8.ok_or("缺少用户名")?;
            let encrypted_password = config.9.ok_or("缺少密码")?;
            let password = deobfuscate_key(&encrypted_password);
            upload_webdav(&url, &username, &password, &local_path, &cloud_path)
        }
        "s3" => {
            let bucket = config.6.ok_or("缺少 Bucket")?;
            let region = config.7.unwrap_or_else(|| "us-east-1".to_string());
            let encrypted_access_key = config.0.ok_or("缺少 Access Key")?;
            let access_key = deobfuscate_key(&encrypted_access_key);
            let encrypted_secret_key = config.9.ok_or("缺少 Secret Key")?;
            let secret_key = deobfuscate_key(&encrypted_secret_key);
            upload_s3(&bucket, &region, &access_key, &secret_key, &local_path, &cloud_path)
        }
        "baidu" => {
            let access_token = deobfuscate_key(&config.0.ok_or("百度网盘未授权")?);
            upload_baidu(&access_token, &local_path, &cloud_path)
        }
        _ => return Err(format!("不支持的 provider: {}", provider)),
    };

    let file_size = std::fs::metadata(&local_path)
        .map(|m| m.len() as i64)
        .ok();

    match result {
        Ok(msg) => {
            record_sync_log(&state, &provider, "backup", &local_file_path, &cloud_path, "success", None, file_size);
            let now = Local::now().to_rfc3339();
            let _ = conn.execute(
                "UPDATE cloud_sync_config SET last_sync_at = ?1, updated_at = ?1 WHERE id = ?2",
                params![&now, &provider],
            );
            Ok(msg)
        }
        Err(e) => {
            record_sync_log(&state, &provider, "backup", &local_file_path, &cloud_path, "failed", Some(&e), file_size);
            Err(format!("同步失败: {}", e))
        }
    }
}

/// Downloads a file from cloud to local
#[tauri::command]
pub fn sync_from_cloud(
    state: tauri::State<DbPool>,
    provider: String,
    cloud_file_path: String,
    local_file_path: String,
) -> Result<String, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;

    let config = conn
        .query_row(
            "SELECT access_token, refresh_token, token_expires_at, sync_path,
                    server_url, bucket, region, username, password
             FROM cloud_sync_config WHERE id = ?1 AND sync_enabled = 1",
            params![&provider],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                ))
            },
        )
        .map_err(|_| format!("{} 未配置或未启用", provider))?;

    let local_path = std::path::PathBuf::from(&local_file_path);

    let result: Result<String, String> = match provider.as_str() {
        "onedrive" => {
            let access_token = deobfuscate_key(&config.0.unwrap_or_default());
            onedrive::download_file(&access_token, &cloud_file_path, &local_path)
                .map(|_| local_file_path.clone())
        }
        "nutstore" | "webdav" => {
            let url = config.4.ok_or("缺少服务器地址")?;
            let username = config.7.ok_or("缺少用户名")?;
            let encrypted_password = config.8.ok_or("缺少密码")?;
            let password = deobfuscate_key(&encrypted_password);
            download_webdav(&url, &username, &password, &cloud_file_path, &local_path)
        }
        "s3" => {
            let bucket = config.5.ok_or("缺少 Bucket")?;
            let region = config.6.unwrap_or_else(|| "us-east-1".to_string());
            let encrypted_access_key = config.0.ok_or("缺少 Access Key")?;
            let access_key = deobfuscate_key(&encrypted_access_key);
            let encrypted_secret_key = config.8.ok_or("缺少 Secret Key")?;
            let secret_key = deobfuscate_key(&encrypted_secret_key);
            download_s3(&bucket, &region, &access_key, &secret_key, &cloud_file_path, &local_path)
        }
        "baidu" => {
            let access_token = deobfuscate_key(&config.0.ok_or("百度网盘未授权")?);
            download_baidu(&access_token, &cloud_file_path, &local_path)
        }
        _ => return Err(format!("不支持的 provider: {}", provider)),
    };

    match result {
        Ok(path) => {
            record_sync_log(&state, &provider, "restore", &local_file_path, &cloud_file_path, "success", None, None);
            Ok(path)
        }
        Err(e) => {
            record_sync_log(&state, &provider, "restore", &local_file_path, &cloud_file_path, "failed", Some(&e), None);
            Err(format!("下载失败: {}", e))
        }
    }
}

/// Gets sync log, optionally filtered by provider
#[tauri::command]
pub fn get_sync_log(
    state: tauri::State<DbPool>,
    provider: Option<String>,
    page: Option<i32>,
    page_size: Option<i32>,
) -> Result<Vec<SyncLogEntry>, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;
    let current_page = page.unwrap_or(1).max(1);
    let size = page_size.unwrap_or(20).max(1).min(100);
    let offset = (current_page - 1) * size;

    let (sql, query_params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref p) = provider {
        (
            "SELECT id, provider, file_type, local_path, cloud_path, sync_status, error_message, file_size, synced_at, created_at
             FROM cloud_sync_log WHERE provider = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
                .to_string(),
            vec![
                Box::new(p.clone()) as Box<dyn rusqlite::types::ToSql>,
                Box::new(size),
                Box::new(offset),
            ],
        )
    } else {
        (
            "SELECT id, provider, file_type, local_path, cloud_path, sync_status, error_message, file_size, synced_at, created_at
             FROM cloud_sync_log ORDER BY created_at DESC LIMIT ?1 OFFSET ?2"
                .to_string(),
            vec![
                Box::new(size) as Box<dyn rusqlite::types::ToSql>,
                Box::new(offset),
            ],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to prepare: {}", e))?;

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();

    let logs = stmt
        .query_map(params_ref.as_slice(), |row| {
            Ok(SyncLogEntry {
                id: row.get(0)?,
                provider: row.get(1)?,
                file_type: row.get(2)?,
                local_path: row.get(3)?,
                cloud_path: row.get(4)?,
                sync_status: row.get(5)?,
                error_message: row.get(6)?,
                file_size: row.get(7)?,
                synced_at: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query logs: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect logs: {}", e))?;

    Ok(logs)
}

/// Deletes a cloud provider config
#[tauri::command]
pub fn delete_cloud_config(
    state: tauri::State<DbPool>,
    provider: String,
) -> Result<String, String> {
    let conn = state.get().map_err(|e| format!("DB connection failed: {}", e))?;
    conn.execute("DELETE FROM cloud_sync_config WHERE id = ?1", params![&provider])
        .map_err(|e| format!("Failed to delete config: {}", e))?;
    Ok(format!("{} 配置已删除", provider))
}

// ─── Internal helpers ─────────────────────────────

fn record_sync_log(
    state: &tauri::State<DbPool>,
    provider: &str,
    file_type: &str,
    local_path: &str,
    cloud_path: &str,
    status: &str,
    error: Option<&str>,
    file_size: Option<i64>,
) {
    if let Ok(conn) = state.get() {
        let id = nanoid::nanoid!();
        let now = Local::now().to_rfc3339();
        let _ = conn.execute(
            "INSERT INTO cloud_sync_log (id, provider, file_type, local_path, cloud_path, sync_status, error_message, file_size, synced_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            params![id, provider, file_type, local_path, cloud_path, status, error, file_size, now],
        );
    }
}

// ─── WebDAV implementation ─────────────────────────

fn test_webdav_connection(url: &str, username: &str, password: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let resp = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").expect("PROPFIND is a valid HTTP method"), url)
        .basic_auth(username, Some(password))
        .header("Depth", "0")
        .send()
        .map_err(|e| format!("连接失败: {}", e))?;

    if resp.status().is_success() || resp.status() == 207 {
        Ok("WebDAV 连接正常".to_string())
    } else {
        Err(format!("连接失败: HTTP {}", resp.status()))
    }
}

fn upload_webdav(
    url: &str,
    username: &str,
    password: &str,
    local_path: &std::path::Path,
    cloud_path: &str,
) -> Result<String, String> {
    let full_url = format!("{}/{}", url.trim_end_matches('/'), cloud_path.trim_start_matches('/'));
    let data = std::fs::read(local_path).map_err(|e| format!("读取文件失败: {}", e))?;

    let client = reqwest::blocking::Client::new();
    let resp = client
        .put(&full_url)
        .basic_auth(username, Some(password))
        .body(data)
        .send()
        .map_err(|e| format!("上传失败: {}", e))?;

    if resp.status().is_success() {
        Ok(format!("已上传到 {}", full_url))
    } else {
        Err(format!("上传失败: HTTP {}", resp.status()))
    }
}

fn download_webdav(
    url: &str,
    username: &str,
    password: &str,
    cloud_path: &str,
    local_path: &std::path::Path,
) -> Result<String, String> {
    let full_url = format!("{}/{}", url.trim_end_matches('/'), cloud_path.trim_start_matches('/'));

    let client = reqwest::blocking::Client::new();
    let resp = client
        .get(&full_url)
        .basic_auth(username, Some(password))
        .send()
        .map_err(|e| format!("下载失败: {}", e))?;

    if resp.status().is_success() {
        let bytes = resp.bytes().map_err(|e| format!("读取响应失败: {}", e))?;
        std::fs::write(local_path, bytes).map_err(|e| format!("写入文件失败: {}", e))?;
        Ok(local_path.to_string_lossy().to_string())
    } else {
        Err(format!("下载失败: HTTP {}", resp.status()))
    }
}

// ─── S3 implementation (using aws-sdk-s3) ─────────────────────────

/// Shared tokio runtime for blocking S3 (aws-sdk) calls.
///
/// Sync Tauri commands run on a dedicated thread pool, NOT on the async
/// runtime, so `Handle::current()` would panic here. We keep a dedicated
/// multi-thread runtime instead and reuse it across all S3 operations.
fn s3_rt() -> &'static tokio::runtime::Runtime {
    static RT: std::sync::OnceLock<tokio::runtime::Runtime> = std::sync::OnceLock::new();
    RT.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(2)
            .build()
            .expect("Failed to create tokio runtime for S3 operations")
    })
}

fn build_s3_client(_bucket: &str, region: &str, access_key: &str, secret_key: &str) -> aws_sdk_s3::Client {
    let rt = s3_rt();
    let credentials = aws_credential_types::Credentials::new(
        access_key,
        secret_key,
        None,
        None,
        "shicore",
    );
    let config = rt.block_on(
        aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(aws_config::Region::new(region.to_string()))
            .credentials_provider(credentials)
            .load(),
    );
    let mut s3_config = aws_sdk_s3::config::Builder::from(&config);
    // Support S3-compatible services (MinIO, etc.) via custom endpoint if needed
    s3_config.set_force_path_style(Some(true));
    aws_sdk_s3::Client::from_conf(s3_config.build())
}

fn test_s3_connection(bucket: &str, region: &str, access_key: &str, secret_key: &str) -> Result<String, String> {
    let rt = s3_rt();
    let credentials = aws_credential_types::Credentials::new(
        access_key,
        secret_key,
        None,
        None,
        "shicore",
    );
    let config = rt.block_on(
        aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(aws_config::Region::new(region.to_string()))
            .credentials_provider(credentials)
            .load(),
    );
    let s3_client = aws_sdk_s3::Client::from_conf(
        aws_sdk_s3::config::Builder::from(&config)
            .force_path_style(true)
            .build(),
    );

    match rt.block_on(s3_client.head_bucket().bucket(bucket).send()) {
        Ok(_) => Ok("S3 连接正常".to_string()),
        Err(e) => {
            let msg = format!("{}", e);
            if msg.contains("403") || msg.contains("Forbidden") {
                // Bucket exists but credentials are wrong - still confirms connectivity
                Ok("S3 连接正常 (认证失败，请检查密钥)".to_string())
            } else if msg.contains("404") || msg.contains("NoSuchBucket") {
                Err(format!("Bucket '{}' 不存在", bucket))
            } else {
                Err(format!("S3 连接失败: {}", e))
            }
        }
    }
}

fn upload_s3(
    bucket: &str,
    region: &str,
    access_key: &str,
    secret_key: &str,
    local_path: &std::path::Path,
    cloud_path: &str,
) -> Result<String, String> {
    let client = build_s3_client(bucket, region, access_key, secret_key);
    let data = std::fs::read(local_path).map_err(|e| format!("读取文件失败: {}", e))?;
    let key = cloud_path.trim_start_matches('/').to_string();

    let rt = s3_rt();
    rt.block_on(
        client
            .put_object()
            .bucket(bucket)
            .key(&key)
            .body(data.into())
            .send(),
    )
    .map_err(|e| format!("S3 上传失败: {}", e))?;

    Ok(format!("已上传到 S3: {}", cloud_path))
}

fn download_s3(
    bucket: &str,
    region: &str,
    access_key: &str,
    secret_key: &str,
    cloud_path: &str,
    local_path: &std::path::Path,
) -> Result<String, String> {
    let client = build_s3_client(bucket, region, access_key, secret_key);
    let key = cloud_path.trim_start_matches('/').to_string();

    let rt = s3_rt();
    let resp = rt
        .block_on(
            client
                .get_object()
                .bucket(bucket)
                .key(&key)
                .send(),
        )
        .map_err(|e| format!("S3 下载失败: {}", e))?;

    let bytes = rt
        .block_on(resp.body.collect())
        .map_err(|e| format!("读取响应失败: {}", e))?
        .into_bytes();

    std::fs::write(local_path, &bytes).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(local_path.to_string_lossy().to_string())
}

// ─── Baidu Netdisk implementation ─────────────────

const BAIDU_CHUNK_SIZE: u64 = 4 * 1024 * 1024; // 4MB per chunk

fn upload_baidu(
    access_token: &str,
    local_path: &std::path::Path,
    cloud_path: &str,
) -> Result<String, String> {
    let file_size = std::fs::metadata(local_path)
        .map(|m| m.len())
        .map_err(|e| format!("获取文件大小失败: {}", e))?;
    let file_data = std::fs::read(local_path).map_err(|e| format!("读取文件失败: {}", e))?;

    let client = reqwest::blocking::Client::new();

    // Step 1: Precreate - initialize upload and get uploadid
    let precreate_resp = client
        .post("https://pan.baidu.com/rest/2.0/xpan/file?method=create")
        .query(&[("access_token", access_token)])
        .form(&[
            ("path", cloud_path),
            ("size", &file_size.to_string()),
            ("isdir", "0"),
            ("autoinit", "1"),
            ("rtype", "3"),
        ])
        .send()
        .map_err(|e| format!("预创建失败: {}", e))?;

    if !precreate_resp.status().is_success() {
        return Err(format!("百度网盘预创建失败: HTTP {}", precreate_resp.status()));
    }

    let precreate_body: serde_json::Value = precreate_resp
        .json()
        .map_err(|e| format!("解析预创建响应失败: {}", e))?;

    let uploadid = precreate_body["uploadid"]
        .as_str()
        .ok_or_else(|| format!("预创建响应缺少 uploadid: {:?}", precreate_body))?
        .to_string();

    // Step 2: Upload chunks (each ≤ 4MB)
    let mut block_list = Vec::new();
    let total_chunks = ((file_size + BAIDU_CHUNK_SIZE - 1) / BAIDU_CHUNK_SIZE) as usize;

    for seq in 0..total_chunks {
        let start = (seq as u64) * BAIDU_CHUNK_SIZE;
        let end = std::cmp::min(start + BAIDU_CHUNK_SIZE, file_size);
        let chunk = &file_data[start as usize..end as usize];

        // Use multipart form upload
        let boundary = format!("----WebKitFormBoundary{}", nanoid::nanoid!());
        let mut body = Vec::new();

        // Add file part
        body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
        body.extend_from_slice(format!("Content-Disposition: form-data; name=\"file\"; filename=\"chunk_{}\"\r\n", seq).as_bytes());
        body.extend_from_slice(b"Content-Type: application/octet-stream\r\n\r\n");
        body.extend_from_slice(chunk);
        body.extend_from_slice(b"\r\n");
        body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());

        let upload_resp = client
            .post("https://d.pcs.baidu.com/rest/2.0/pcs/superfile2")
            .query(&[
                ("method", "upload"),
                ("access_token", access_token),
                ("type", "tmpfile"),
                ("path", cloud_path),
                ("uploadid", &uploadid),
                ("partseq", &seq.to_string()),
            ])
            .header("Content-Type", format!("multipart/form-data; boundary={}", boundary))
            .body(body)
            .send()
            .map_err(|e| format!("上传分片 {} 失败: {}", seq, e))?;

        if !upload_resp.status().is_success() {
            return Err(format!("上传分片 {} 失败: HTTP {}", seq, upload_resp.status()));
        }

        let upload_body: serde_json::Value = upload_resp
            .json()
            .map_err(|e| format!("解析上传分片响应失败: {}", e))?;

        let md5 = upload_body["md5"]
            .as_str()
            .ok_or_else(|| "上传分片响应缺少 md5".to_string())?
            .to_string();
        block_list.push(md5);
    }

    // Step 3: Create - finalize the upload
    let create_resp = client
        .post("https://pan.baidu.com/rest/2.0/xpan/file?method=create")
        .query(&[("access_token", access_token)])
        .json(&serde_json::json!({
            "path": cloud_path,
            "size": file_size,
            "isdir": 0,
            "rtype": 3,
            "uploadid": uploadid,
            "block_list": block_list,
        }))
        .send()
        .map_err(|e| format!("创建文件失败: {}", e))?;

    if !create_resp.status().is_success() {
        return Err(format!("百度网盘创建文件失败: HTTP {}", create_resp.status()));
    }

    let create_body: serde_json::Value = create_resp
        .json()
        .map_err(|e| format!("解析创建文件响应失败: {}", e))?;

    if let Some(errno) = create_body["errno"].as_i64() {
        if errno != 0 {
            return Err(format!("百度网盘创建文件失败: errno={}", errno));
        }
    }

    Ok(format!("已上传到百度网盘: {}", cloud_path))
}

fn download_baidu(
    access_token: &str,
    cloud_path: &str,
    local_path: &std::path::Path,
) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();

    // Step 1: List files in parent directory to find the file's fs_id
    let parent_dir = std::path::Path::new(cloud_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());
    let file_name = std::path::Path::new(cloud_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or_else(|| format!("无法解析文件名: {}", cloud_path))?;

    let list_resp = client
        .get("https://pan.baidu.com/rest/2.0/xpan/file")
        .query(&[
            ("method", "list"),
            ("access_token", access_token),
            ("dir", &parent_dir),
            ("search", &file_name),
            ("page", "1"),
            ("num", "100"),
            ("web", "1"),
        ])
        .send()
        .map_err(|e| format!("列出文件失败: {}", e))?;

    if !list_resp.status().is_success() {
        return Err(format!("百度网盘列出文件失败: HTTP {}", list_resp.status()));
    }

    let list_body: serde_json::Value = list_resp
        .json()
        .map_err(|e| format!("解析文件列表响应失败: {}", e))?;

    // Find the file with matching path
    let fs_id = list_body["list"]
        .as_array()
        .and_then(|files| {
            files.iter().find_map(|f| {
                let path = f["path"].as_str().unwrap_or("");
                if path == cloud_path {
                    f["fs_id"].as_i64()
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| format!("未找到文件: {}", cloud_path))?;

    // Step 2: Get download link using filemetas with correct fs_id
    let meta_resp = client
        .get("https://pan.baidu.com/rest/2.0/xpan/multimedia")
        .query(&[
            ("method", "filemetas"),
            ("access_token", access_token),
            ("fsids", &format!("[{}]", fs_id)),
            ("dlink", "1"),
        ])
        .send()
        .map_err(|e| format!("获取文件元数据失败: {}", e))?;

    if !meta_resp.status().is_success() {
        return Err(format!("百度网盘获取元数据失败: HTTP {}", meta_resp.status()));
    }

    let meta_body: serde_json::Value = meta_resp
        .json()
        .map_err(|e| format!("解析元数据响应失败: {}", e))?;

    let dlink = meta_body["list"][0]["dlink"]
        .as_str()
        .ok_or_else(|| "未找到文件下载链接".to_string())?;

    // Step 3: Download from dlink
    let dl_resp = client
        .get(dlink)
        .header("User-Agent", "pan.baidu.com")
        .send()
        .map_err(|e| format!("下载失败: {}", e))?;

    if !dl_resp.status().is_success() {
        return Err(format!("下载失败: HTTP {}", dl_resp.status()));
    }

    let bytes = dl_resp.bytes().map_err(|e| format!("读取响应失败: {}", e))?;
    std::fs::write(local_path, bytes).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(local_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cloud_provider_as_str() {
        assert_eq!(CloudProvider::Baidu.as_str(), "baidu");
        assert_eq!(CloudProvider::Onedrive.as_str(), "onedrive");
        assert_eq!(CloudProvider::Nutstore.as_str(), "nutstore");
        assert_eq!(CloudProvider::Webdav.as_str(), "webdav");
        assert_eq!(CloudProvider::S3.as_str(), "s3");
    }

    #[test]
    fn test_cloud_provider_display_name() {
        assert_eq!(CloudProvider::Baidu.display_name(), "百度网盘");
        assert_eq!(CloudProvider::Onedrive.display_name(), "OneDrive");
        assert_eq!(CloudProvider::Nutstore.display_name(), "坚果云");
        assert_eq!(CloudProvider::Webdav.display_name(), "WebDAV");
        assert_eq!(CloudProvider::S3.display_name(), "S3 兼容存储");
    }

    #[test]
    fn test_save_cloud_config_input_deserialization() {
        let json = r#"{"provider": "webdav", "serverUrl": "https://example.com/dav", "username": "user", "password": "pass"}"#;
        let input: SaveCloudConfigInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.provider, "webdav");
        assert_eq!(input.server_url, Some("https://example.com/dav".to_string()));
        assert_eq!(input.username, Some("user".to_string()));
        assert_eq!(input.password, Some("pass".to_string()));
    }

    #[test]
    fn test_save_cloud_config_input_optional_fields() {
        let json = r#"{"provider": "onedrive"}"#;
        let input: SaveCloudConfigInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.provider, "onedrive");
        assert_eq!(input.server_url, None);
        assert_eq!(input.username, None);
        assert_eq!(input.password, None);
        assert_eq!(input.sync_enabled, None);
    }

    #[test]
    fn test_cloud_provider_roundtrip_serde() {
        for provider in &[CloudProvider::Baidu, CloudProvider::Onedrive, CloudProvider::Nutstore, CloudProvider::Webdav, CloudProvider::S3] {
            let json = serde_json::to_string(provider).unwrap();
            let deserialized: CloudProvider = serde_json::from_str(&json).unwrap();
            assert_eq!(*provider, deserialized);
        }
    }

    #[test]
    fn test_cloud_config_serialization() {
        let config = CloudConfig {
            provider: "webdav".to_string(),
            sync_enabled: true,
            last_sync_at: Some("2026-01-01T00:00:00Z".to_string()),
            sync_path: "/Shicore".to_string(),
            token_valid: true,
            server_url: Some("https://example.com/dav".to_string()),
            bucket: None,
            region: None,
            username: Some("user".to_string()),
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"provider\":\"webdav\""));
        assert!(json.contains("\"syncEnabled\":true"));
        assert!(json.contains("\"serverUrl\":\"https://example.com/dav\""));
    }
}
