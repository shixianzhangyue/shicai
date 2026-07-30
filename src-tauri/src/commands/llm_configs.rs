use crate::db::pool::DbPool;
use crate::services::llm_client::{
    CreateLlmConfigInput, LlmClient, LlmConfig, UpdateLlmConfigInput, obfuscate_key,
};
use rusqlite::OptionalExtension;
use rusqlite::params;

/// Lists all LLM configurations ordered by creation time (newest first).
#[tauri::command]
pub fn list_llm_configs(state: tauri::State<DbPool>) -> Result<Vec<LlmConfig>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare("SELECT id, provider, api_key, base_url, model_name, is_default, created_at, updated_at FROM llm_configs ORDER BY created_at DESC")
        .map_err(|e| {
            let msg = format!("Failed to prepare list_llm_configs query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let configs = stmt
        .query_map([], |row| {
            let api_key: String = row.get(2)?;
            // SECURITY: Mask API key before sending to frontend
            let masked_key = if api_key.len() > 8 {
                format!("{}...{}", &api_key[..4], &api_key[api_key.len()-4..])
            } else {
                "****".to_string()
            };
            Ok(LlmConfig {
                id: row.get(0)?,
                provider: row.get(1)?,
                api_key: masked_key,
                base_url: row.get(3)?,
                model_name: row.get(4)?,
                is_default: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_llm_configs query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect llm configs: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(configs)
}

/// Creates a new LLM configuration.
#[tauri::command]
pub fn create_llm_config(
    state: tauri::State<DbPool>,
    input: CreateLlmConfigInput,
) -> Result<LlmConfig, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let obfuscated_key = obfuscate_key(&input.api_key);

    conn.execute(
        "INSERT INTO llm_configs (provider, api_key, base_url, model_name, is_default) VALUES (?1, ?2, ?3, ?4, 0)",
        params![&input.provider, &obfuscated_key, &input.base_url, &input.model_name],
    )
    .map_err(|e| {
        let msg = format!("Failed to create llm config: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = conn.last_insert_rowid();

    let config = conn
        .query_row(
            "SELECT id, provider, api_key, base_url, model_name, is_default, created_at, updated_at FROM llm_configs WHERE id = ?1",
            params![id],
            |row| {
                let api_key: String = row.get(2)?;
                let masked_key = if api_key.len() > 8 {
                    format!("{}...{}", &api_key[..4], &api_key[api_key.len()-4..])
                } else {
                    "****".to_string()
                };
                Ok(LlmConfig {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    api_key: masked_key,
                    base_url: row.get(3)?,
                    model_name: row.get(4)?,
                    is_default: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch created llm config: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Created LLM config id {} for provider {}", config.id, config.provider);
    Ok(config)
}

/// Updates an existing LLM configuration.
#[tauri::command]
pub fn update_llm_config(
    state: tauri::State<DbPool>,
    id: i64,
    input: UpdateLlmConfigInput,
) -> Result<LlmConfig, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let tx = conn.unchecked_transaction().map_err(|e| {
        let msg = format!("Failed to start transaction: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut updates: Vec<String> = Vec::new();
    let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();

    if let Some(ref provider) = input.provider {
        updates.push("provider = ?".to_string());
        params_vec.push(rusqlite::types::Value::Text(provider.clone()));
    }
    let obfuscated_key = input.api_key.as_ref().map(|k| obfuscate_key(k));
    if let Some(ref key) = obfuscated_key {
        updates.push("api_key = ?".to_string());
        params_vec.push(rusqlite::types::Value::Text(key.clone()));
    }
    if let Some(ref base_url) = input.base_url {
        updates.push("base_url = ?".to_string());
        params_vec.push(rusqlite::types::Value::Text(base_url.clone()));
    }
    if let Some(ref model_name) = input.model_name {
        updates.push("model_name = ?".to_string());
        params_vec.push(rusqlite::types::Value::Text(model_name.clone()));
    }

    let should_set_default = if let Some(is_default) = input.is_default {
        updates.push("is_default = ?".to_string());
        params_vec.push(rusqlite::types::Value::Integer(if is_default { 1 } else { 0 }));
        is_default
    } else {
        false
    };

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    let sql = format!(
        "UPDATE llm_configs SET {} WHERE id = ?",
        updates.join(", ")
    );
    params_vec.push(rusqlite::types::Value::Integer(id));

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    tx.execute(&sql, param_refs.as_slice()).map_err(|e| {
        let msg = format!("Failed to update llm config: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    if should_set_default {
        tx.execute(
            "UPDATE llm_configs SET is_default = 0 WHERE id != ?1",
            params![id],
        )
        .map_err(|e| {
            let msg = format!("Failed to reset other default configs: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    tx.commit().map_err(|e| {
        let msg = format!("Failed to commit transaction: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let config = conn
        .query_row(
            "SELECT id, provider, api_key, base_url, model_name, is_default, created_at, updated_at FROM llm_configs WHERE id = ?1",
            params![id],
            |row| {
                let api_key: String = row.get(2)?;
                let masked_key = if api_key.len() > 8 {
                    format!("{}...{}", &api_key[..4], &api_key[api_key.len()-4..])
                } else {
                    "****".to_string()
                };
                Ok(LlmConfig {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    api_key: masked_key,
                    base_url: row.get(3)?,
                    model_name: row.get(4)?,
                    is_default: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch updated llm config: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Updated LLM config id {}", config.id);
    Ok(config)
}

/// Deletes an LLM configuration by its ID.
#[tauri::command]
pub fn delete_llm_config(state: tauri::State<DbPool>, id: i64) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute("DELETE FROM llm_configs WHERE id = ?1", params![id])
        .map_err(|e| {
            let msg = format!("Failed to delete llm config: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Deleted LLM config id {}", id);
    Ok(())
}

/// Returns the default LLM configuration, if any.
#[tauri::command]
pub fn get_default_llm_config(state: tauri::State<DbPool>) -> Result<Option<LlmConfig>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let config = conn
        .query_row(
            "SELECT id, provider, api_key, base_url, model_name, is_default, created_at, updated_at FROM llm_configs WHERE is_default = 1 LIMIT 1",
            [],
            |row| {
                Ok(LlmConfig {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    api_key: row.get(2)?,
                    base_url: row.get(3)?,
                    model_name: row.get(4)?,
                    is_default: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(|e| {
            let msg = format!("Failed to fetch default llm config: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(config)
}

/// Tests the LLM connection with the provided configuration.
#[tauri::command]
pub async fn test_llm_connection(
    provider: String,
    api_key: String,
    base_url: String,
    model_name: String,
) -> Result<String, String> {
    let obfuscated_key = obfuscate_key(&api_key);
    let config = LlmConfig {
        id: 0,
        provider,
        api_key: obfuscated_key,
        base_url,
        model_name,
        is_default: false,
        created_at: String::new(),
        updated_at: String::new(),
    };

    LlmClient::test_connection(&config)
        .await
        .map_err(|e| e.to_string())
}
