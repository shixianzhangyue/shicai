use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// Follow-up template entity.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUpTemplate {
    pub id: String,
    pub name: String,
    pub title: String,
    pub description: Option<String>,
    pub default_interval_days: i32,
    pub stage_trigger: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating a follow-up template.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateInput {
    pub name: String,
    pub title: String,
    pub description: Option<String>,
    pub default_interval_days: Option<i32>,
    pub stage_trigger: Option<String>,
}

/// Input for updating a follow-up template.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplateInput {
    pub name: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub default_interval_days: Option<i32>,
    pub stage_trigger: Option<String>,
    pub is_active: Option<bool>,
}

/// Lists all follow-up templates.
#[tauri::command]
pub fn list_follow_up_templates(
    state: tauri::State<DbPool>,
) -> Result<Vec<FollowUpTemplate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, title, description, default_interval_days, stage_trigger, is_active, created_at, updated_at FROM follow_up_templates ORDER BY name ASC",
        )
        .map_err(|e| format!("Failed to prepare list_follow_up_templates query: {}", e))?;

    let templates = stmt
        .query_map([], |row| {
            let is_active_raw: i32 = row.get(6)?;
            Ok(FollowUpTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                default_interval_days: row.get(4)?,
                stage_trigger: row.get(5)?,
                is_active: is_active_raw != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to execute list_follow_up_templates query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect follow-up templates: {}", e))?;

    Ok(templates)
}

/// Creates a new follow-up template.
#[tauri::command]
pub fn create_follow_up_template(
    state: tauri::State<DbPool>,
    input: CreateTemplateInput,
) -> Result<FollowUpTemplate, String> {
    if input.name.trim().is_empty() {
        return Err("模板名称不能为空".to_string());
    }
    if input.title.trim().is_empty() {
        return Err("模板标题不能为空".to_string());
    }

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();
    let interval = input.default_interval_days.unwrap_or(7);

    conn.execute(
        "INSERT INTO follow_up_templates (id, name, title, description, default_interval_days, stage_trigger, is_active, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)",
        params![
            &id,
            &input.name,
            &input.title,
            &input.description,
            interval,
            &input.stage_trigger,
            &now,
        ],
    )
    .map_err(|e| format!("Failed to create follow-up template: {}", e))?;

    log::info!("Created follow-up template '{}' with id {}", input.name, id);

    Ok(FollowUpTemplate {
        id,
        name: input.name,
        title: input.title,
        description: input.description,
        default_interval_days: interval,
        stage_trigger: input.stage_trigger,
        is_active: true,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Updates an existing follow-up template.
#[tauri::command]
pub fn update_follow_up_template(
    state: tauri::State<DbPool>,
    id: String,
    input: UpdateTemplateInput,
) -> Result<FollowUpTemplate, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut updates: Vec<String> = Vec::new();
    if input.name.is_some() {
        updates.push("name = ?".to_string());
    }
    if input.title.is_some() {
        updates.push("title = ?".to_string());
    }
    if input.description.is_some() {
        updates.push("description = ?".to_string());
    }
    if input.default_interval_days.is_some() {
        updates.push("default_interval_days = ?".to_string());
    }
    if input.stage_trigger.is_some() {
        updates.push("stage_trigger = ?".to_string());
    }
    if input.is_active.is_some() {
        updates.push("is_active = ?".to_string());
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    updates.push("updated_at = ?".to_string());
    let sql = format!(
        "UPDATE follow_up_templates SET {} WHERE id = ?",
        updates.join(", ")
    );

    let now = Local::now().to_rfc3339();

    let mut param_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(ref v) = input.name {
        param_refs.push(v);
    }
    if let Some(ref v) = input.title {
        param_refs.push(v);
    }
    if let Some(ref v) = input.description {
        param_refs.push(v);
    }
    let interval_val;
    if let Some(v) = input.default_interval_days {
        interval_val = v;
        param_refs.push(&interval_val);
    }
    if let Some(ref v) = input.stage_trigger {
        param_refs.push(v);
    }
    let active_val;
    if let Some(v) = input.is_active {
        active_val = if v { 1i32 } else { 0i32 };
        param_refs.push(&active_val);
    }
    param_refs.push(&now);
    param_refs.push(&id);

    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update follow-up template: {}", e))?;

    // Fetch the updated template
    let template = conn.query_row(
        "SELECT id, name, title, description, default_interval_days, stage_trigger, is_active, created_at, updated_at FROM follow_up_templates WHERE id = ?1",
        params![&id],
        |row| {
            let is_active_raw: i32 = row.get(6)?;
            Ok(FollowUpTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                default_interval_days: row.get(4)?,
                stage_trigger: row.get(5)?,
                is_active: is_active_raw != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| format!("Failed to fetch updated template: {}", e))?;

    log::info!("Updated follow-up template '{}' (id {})", template.name, id);
    Ok(template)
}

/// Deletes a follow-up template.
#[tauri::command]
pub fn delete_follow_up_template(
    state: tauri::State<DbPool>,
    id: String,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Check if template is in use
    let in_use: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM follow_ups WHERE template_id = ?1",
            params![&id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if in_use {
        return Err("该模板正在被使用，无法删除".to_string());
    }

    conn.execute("DELETE FROM follow_up_templates WHERE id = ?1", params![&id])
        .map_err(|e| format!("Failed to delete follow-up template: {}", e))?;

    log::info!("Deleted follow-up template (id {})", id);
    Ok(())
}
