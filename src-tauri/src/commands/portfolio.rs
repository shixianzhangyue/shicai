use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use std::path::Path;
use tauri::Manager;

/// ─── Portfolio Types ─────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioItem {
    pub id: String,
    pub candidate_id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String, // "file" or "link"
    pub description: Option<String>,
    pub uploaded_at: String,
}

/// ─── Upload a portfolio file (image/PDF) ─────────────────

#[tauri::command]
pub fn upload_portfolio_file(
    app: tauri::AppHandle,
    state: tauri::State<'_, DbPool>,
    candidate_id: String,
    file_path: String,
    description: Option<String>,
) -> Result<PortfolioItem, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let src = Path::new(&file_path);
    if !src.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    // Copy file to app data dir: portfolios/{candidate_id}/
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let portfolio_dir = app_data_dir.join("portfolios").join(&candidate_id);
    std::fs::create_dir_all(&portfolio_dir)
        .map_err(|e| format!("Failed to create portfolio directory: {}", e))?;

    let original_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("portfolio_file");
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let dest_filename = format!("{}_{}", timestamp, original_name);
    let dest_path = portfolio_dir.join(&dest_filename);

    std::fs::copy(src, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    let file_type = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_lowercase();

    let stored_path = dest_path
        .to_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| dest_filename.clone());

    let id = nanoid::nanoid!();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO portfolios (id, candidate_id, file_path, file_name, file_type, description, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, candidate_id, stored_path, original_name, file_type, description, now],
    )
    .map_err(|e| format!("数据库写入失败: {}", e))?;

    Ok(PortfolioItem {
        id,
        candidate_id,
        file_path: stored_path,
        file_name: original_name.to_string(),
        file_type,
        description,
        uploaded_at: now,
    })
}

/// ─── Add a portfolio link (URL) ──────────────────────────

#[tauri::command]
pub fn add_portfolio_link(
    state: tauri::State<'_, DbPool>,
    candidate_id: String,
    url: String,
    file_name: String,
    description: Option<String>,
) -> Result<PortfolioItem, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO portfolios (id, candidate_id, file_path, file_name, file_type, description, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, candidate_id, url, file_name, "link", description, now],
    )
    .map_err(|e| format!("数据库写入失败: {}", e))?;

    Ok(PortfolioItem {
        id,
        candidate_id,
        file_path: url,
        file_name,
        file_type: "link".to_string(),
        description,
        uploaded_at: now,
    })
}

/// ─── List portfolio items for a candidate ────────────────

#[tauri::command]
pub fn list_portfolios(
    state: tauri::State<'_, DbPool>,
    candidate_id: String,
) -> Result<Vec<PortfolioItem>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, candidate_id, file_path, file_name, file_type, description, uploaded_at
             FROM portfolios
             WHERE candidate_id = ?1
             ORDER BY uploaded_at DESC",
        )
        .map_err(|e| format!("查询失败: {}", e))?;

    let items = stmt
        .query_map(params![candidate_id], |row| {
            Ok(PortfolioItem {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_type: row.get(4)?,
                description: row.get(5)?,
                uploaded_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("数据读取失败: {}", e))?;

    Ok(items)
}

/// ─── Delete a portfolio item ─────────────────────────────

#[tauri::command]
pub fn delete_portfolio(
    state: tauri::State<'_, DbPool>,
    id: String,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Get the record to check if we need to delete the file
    let item: Result<PortfolioItem, _> = conn.query_row(
        "SELECT id, candidate_id, file_path, file_name, file_type, description, uploaded_at
         FROM portfolios WHERE id = ?1",
        params![id],
        |row| {
            Ok(PortfolioItem {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_type: row.get(4)?,
                description: row.get(5)?,
                uploaded_at: row.get(6)?,
            })
        },
    );

    match item {
        Ok(item) => {
            // Delete the physical file if it's a file type
            if item.file_type != "link" {
                let path = Path::new(&item.file_path);
                if path.exists() {
                    let _ = std::fs::remove_file(path);
                }
            }
            // Delete DB record
            conn.execute("DELETE FROM portfolios WHERE id = ?1", params![id])
                .map_err(|e| format!("删除失败: {}", e))?;
            Ok(())
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err("作品集记录不存在".to_string())
        }
        Err(e) => Err(format!("查询失败: {}", e)),
    }
}
