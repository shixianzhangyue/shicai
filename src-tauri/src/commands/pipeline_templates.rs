use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Pipeline template entity.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineTemplate {
    pub id: String,
    pub name: String,
    pub stages_json: String,
    pub created_at: String,
}

/// Lists all pipeline templates ordered by created_at DESC.
#[tauri::command]
pub fn list_pipeline_templates(state: tauri::State<DbPool>) -> Result<Vec<PipelineTemplate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, stages_json, created_at FROM pipeline_templates ORDER BY created_at DESC",
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare list_pipeline_templates query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let templates = stmt
        .query_map([], |row| {
            Ok(PipelineTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                stages_json: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_pipeline_templates query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect pipeline templates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(templates)
}

/// Creates a new pipeline template.
#[tauri::command]
pub fn create_pipeline_template(
    state: tauri::State<DbPool>,
    name: String,
    stages_json: String,
) -> Result<PipelineTemplate, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO pipeline_templates (id, name, stages_json, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![&id, &name, &stages_json, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to create pipeline template: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created pipeline template '{}' with id {}", name, id);

    Ok(PipelineTemplate {
        id,
        name,
        stages_json,
        created_at: now,
    })
}

/// Deletes a pipeline template by ID.
#[tauri::command]
pub fn delete_pipeline_template(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute(
        "DELETE FROM pipeline_templates WHERE id = ?1",
        params![&id],
    )
    .map_err(|e| {
        let msg = format!("Failed to delete pipeline template: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Deleted pipeline template with id {}", id);
    Ok(())
}
