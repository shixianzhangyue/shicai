use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Tag entity returned by tag commands.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

/// Lists all tags ordered by creation time (newest first).
#[tauri::command]
pub fn list_tags(state: tauri::State<DbPool>) -> Result<Vec<Tag>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, color, created_at FROM tags ORDER BY created_at DESC",
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare list_tags query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_tags query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect tags: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(tags)
}

/// Creates a new tag with the given name and optional color.
///
/// Defaults color to `#3b82f6` when not provided.
#[tauri::command]
pub fn create_tag(
    state: tauri::State<DbPool>,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();
    let tag_color = color.unwrap_or_else(|| "#3b82f6".to_string());

    conn.execute(
        "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![&id, &name, &tag_color, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to create tag: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created tag '{}' with id {}", name, id);

    Ok(Tag {
        id,
        name,
        color: tag_color,
        created_at: now,
    })
}

/// Updates an existing tag's name and/or color.
#[tauri::command]
pub fn update_tag(
    state: tauri::State<DbPool>,
    id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<Tag, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Build dynamic update query based on provided fields.
    let mut updates: Vec<String> = Vec::new();
    if name.is_some() {
        updates.push("name = ?".to_string());
    }
    if color.is_some() {
        updates.push("color = ?".to_string());
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    let sql = format!("UPDATE tags SET {} WHERE id = ?", updates.join(", "));

    // Collect parameters in the correct order.
    let mut param_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(ref n) = name {
        param_refs.push(n);
    }
    if let Some(ref c) = color {
        param_refs.push(c);
    }
    param_refs.push(&id);

    conn.execute(&sql, param_refs.as_slice()).map_err(|e| {
        let msg = format!("Failed to update tag: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Fetch the updated tag.
    let tag = conn
        .query_row(
            "SELECT id, name, color, created_at FROM tags WHERE id = ?1",
            params![&id],
            |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch updated tag: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Updated tag '{}' (id {})", tag.name, tag.id);
    Ok(tag)
}

/// Deletes a tag by its ID.
#[tauri::command]
pub fn delete_tag(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute("DELETE FROM tags WHERE id = ?1", params![&id])
        .map_err(|e| {
            let msg = format!("Failed to delete tag: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Deleted tag with id {}", id);
    Ok(())
}
