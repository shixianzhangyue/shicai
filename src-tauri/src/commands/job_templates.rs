use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Job template entity returned by job template commands.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobTemplate {
    pub id: String,
    pub name: String,
    pub content: String,
    pub created_at: String,
}

/// Lists all job templates ordered by creation time (newest first).
#[tauri::command]
pub fn list_job_templates(state: tauri::State<DbPool>) -> Result<Vec<JobTemplate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, content, created_at FROM job_templates ORDER BY created_at DESC",
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare list_job_templates query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let templates = stmt
        .query_map([], |row| {
            Ok(JobTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_job_templates query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect job templates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(templates)
}

/// Creates a new job template with the given name and content JSON.
#[tauri::command]
pub fn create_job_template(
    state: tauri::State<DbPool>,
    name: String,
    content: String,
) -> Result<JobTemplate, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO job_templates (id, name, content, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![&id, &name, &content, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to create job template: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created job template '{}' with id {}", name, id);

    Ok(JobTemplate {
        id,
        name,
        content,
        created_at: now,
    })
}

/// Deletes a job template by its ID.
#[tauri::command]
pub fn delete_job_template(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute(
        "DELETE FROM job_templates WHERE id = ?1",
        params![&id],
    )
    .map_err(|e| {
        let msg = format!("Failed to delete job template: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Deleted job template with id {}", id);
    Ok(())
}
