use crate::db::pool::DbPool;
use crate::services::baidu_ocr::{BaiduOcrClient, CreateOcrConfigInput, OcrConfig, UpdateOcrConfigInput, OcrResult};
use rusqlite::OptionalExtension;

/// Lists all OCR configurations.
#[tauri::command]
pub async fn list_ocr_configs(
    state: tauri::State<'_, DbPool>,
) -> Result<Vec<OcrConfig>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare("SELECT id, provider, api_key, secret_key, is_default, created_at, updated_at FROM ocr_configs ORDER BY is_default DESC, updated_at DESC")
        .map_err(|e| format!("Database error: {}", e))?;

    let configs = stmt
        .query_map([], |row| {
            Ok(OcrConfig {
                id: row.get(0)?,
                provider: row.get(1)?,
                api_key: row.get(2)?,
                secret_key: row.get(3)?,
                is_default: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Database error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(configs)
}

/// Creates a new OCR configuration.
#[tauri::command]
pub async fn create_ocr_config(
    state: tauri::State<'_, DbPool>,
    input: CreateOcrConfigInput,
) -> Result<OcrConfig, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // If this is the first config, make it default
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM ocr_configs", [], |row| row.get(0))
        .map_err(|e| format!("Database error: {}", e))?;

    let is_default = if count == 0 { 1 } else { 0 };

    conn.execute(
        "INSERT INTO ocr_configs (provider, api_key, secret_key, is_default) VALUES (?1, ?2, ?3, ?4)",
        [&input.provider, &input.api_key, &input.secret_key, &is_default.to_string()],
    )
    .map_err(|e| format!("Database error: {}", e))?;

    let id = conn.last_insert_rowid();

    let config = conn
        .query_row(
            "SELECT id, provider, api_key, secret_key, is_default, created_at, updated_at FROM ocr_configs WHERE id = ?1",
            [id],
            |row| {
                Ok(OcrConfig {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    api_key: row.get(2)?,
                    secret_key: row.get(3)?,
                    is_default: row.get::<_, i32>(4)? != 0,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(config)
}

/// Updates an existing OCR configuration.
#[tauri::command]
pub async fn update_ocr_config(
    state: tauri::State<'_, DbPool>,
    id: i64,
    input: UpdateOcrConfigInput,
) -> Result<OcrConfig, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Build dynamic update query
    let mut updates = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(provider) = &input.provider {
        updates.push("provider = ?");
        params.push(Box::new(provider.clone()));
    }
    if let Some(api_key) = &input.api_key {
        updates.push("api_key = ?");
        params.push(Box::new(api_key.clone()));
    }
    if let Some(secret_key) = &input.secret_key {
        updates.push("secret_key = ?");
        params.push(Box::new(secret_key.clone()));
    }
    if let Some(is_default) = input.is_default {
        updates.push("is_default = ?");
        params.push(Box::new(is_default as i32));
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    // If setting as default, unset others first
    if input.is_default == Some(true) {
        conn.execute("UPDATE ocr_configs SET is_default = 0", [])
            .map_err(|e| format!("Database error: {}", e))?;
    }

    let sql = format!("UPDATE ocr_configs SET {} WHERE id = ?", updates.join(", "));
    params.push(Box::new(id));

    conn.execute(&sql, rusqlite::params_from_iter(params.iter()))
        .map_err(|e| format!("Database error: {}", e))?;

    let config = conn
        .query_row(
            "SELECT id, provider, api_key, secret_key, is_default, created_at, updated_at FROM ocr_configs WHERE id = ?1",
            [id],
            |row| {
                Ok(OcrConfig {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    api_key: row.get(2)?,
                    secret_key: row.get(3)?,
                    is_default: row.get::<_, i32>(4)? != 0,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(config)
}

/// Deletes an OCR configuration.
#[tauri::command]
pub async fn delete_ocr_config(
    state: tauri::State<'_, DbPool>,
    id: i64,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute("DELETE FROM ocr_configs WHERE id = ?1", [id])
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

/// Gets the default OCR configuration.
#[tauri::command]
pub async fn get_default_ocr_config(
    state: tauri::State<'_, DbPool>,
) -> Result<Option<OcrConfig>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let config = conn
        .query_row(
            "SELECT id, provider, api_key, secret_key, is_default, created_at, updated_at FROM ocr_configs WHERE is_default = 1 LIMIT 1",
            [],
            |row| {
                Ok(OcrConfig {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    api_key: row.get(2)?,
                    secret_key: row.get(3)?,
                    is_default: row.get::<_, i32>(4)? != 0,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(config)
}

/// Tests OCR connection with the given configuration.
#[tauri::command]
pub async fn test_ocr_connection(
    _state: tauri::State<'_, DbPool>,
    api_key: String,
    secret_key: String,
) -> Result<String, String> {
    BaiduOcrClient::test_connection(&api_key, &secret_key)
        .await
        .map_err(|e| e.to_string())
}

/// Performs OCR on an image using the default configuration.
#[tauri::command]
pub async fn ocr_image(
    state: tauri::State<'_, DbPool>,
    image_base64: String,
) -> Result<OcrResult, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let config = conn
        .query_row(
            "SELECT api_key, secret_key FROM ocr_configs WHERE is_default = 1 LIMIT 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                ))
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "请先配置 OCR".to_string(),
            _ => format!("Database error: {}", e),
        })?;

    BaiduOcrClient::recognize_image(&config.0, &config.1, &image_base64)
        .await
        .map_err(|e| e.to_string())
}