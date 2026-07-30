use crate::db::pool::DbPool;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Metadata for an exportable field.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableFieldMeta {
    pub key: String,
    pub label: String,
}

/// Configuration for data export.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportConfig {
    pub fields: Vec<String>,
    pub field_order: Vec<String>,
    pub format: String,
    pub scope: String,
    pub job_id: Option<String>,
    pub candidate_ids: Option<Vec<String>>,
}

/// Result of a data export operation.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub data: Vec<HashMap<String, String>>,
    pub field_order: Vec<String>,
}

/// Returns metadata for all exportable fields.
#[tauri::command]
pub fn get_exportable_fields() -> Result<Vec<ExportableFieldMeta>, String> {
    Ok(vec![
        ExportableFieldMeta {
            key: "name".to_string(),
            label: "姓名".to_string(),
        },
        ExportableFieldMeta {
            key: "phone".to_string(),
            label: "手机".to_string(),
        },
        ExportableFieldMeta {
            key: "email".to_string(),
            label: "邮箱".to_string(),
        },
        ExportableFieldMeta {
            key: "currentCompany".to_string(),
            label: "公司".to_string(),
        },
        ExportableFieldMeta {
            key: "currentPosition".to_string(),
            label: "职位".to_string(),
        },
        ExportableFieldMeta {
            key: "education".to_string(),
            label: "学历".to_string(),
        },
        ExportableFieldMeta {
            key: "yearsExp".to_string(),
            label: "经验".to_string(),
        },
        ExportableFieldMeta {
            key: "source".to_string(),
            label: "来源".to_string(),
        },
        ExportableFieldMeta {
            key: "tags".to_string(),
            label: "标签".to_string(),
        },
        ExportableFieldMeta {
            key: "createdAt".to_string(),
            label: "创建时间".to_string(),
        },
    ])
}

/// Exports candidate data according to the provided configuration.
///
/// Scope:
/// - `all`: all non-deleted candidates.
/// - `job`: candidates associated with a specific job.
/// - `filtered`: candidates matching the provided candidate IDs.
#[tauri::command]
pub fn export_data(
    state: tauri::State<DbPool>,
    config: ExportConfig,
) -> Result<ExportResult, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Build the base query depending on scope.
    let (sql, sql_params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match config.scope.as_str() {
        "job" => {
            let job_id = config.job_id.ok_or_else(|| {
                let msg = "job_id is required when scope is 'job'".to_string();
                log::error!("{}", msg);
                msg
            })?;
            let query = format!(
                "SELECT {} FROM candidates c
                 JOIN candidate_pipeline cp ON cp.candidate_id = c.id
                 WHERE cp.job_id = ?1 AND c.deleted_at IS NULL",
                select_columns(&config.fields)
            );
            let params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(job_id)];
            (query, params)
        }
        "filtered" => {
            let ids = config.candidate_ids.ok_or_else(|| {
                let msg = "candidate_ids is required when scope is 'filtered'".to_string();
                log::error!("{}", msg);
                msg
            })?;
            if ids.is_empty() {
                return Ok(ExportResult {
                    data: vec![],
                    field_order: config.field_order,
                });
            }
            let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let query = format!(
                "SELECT {} FROM candidates c
                 WHERE c.id IN ({}) AND c.deleted_at IS NULL",
                select_columns(&config.fields),
                placeholders
            );
            let params: Vec<Box<dyn rusqlite::ToSql>> =
                ids.into_iter().map(|id| Box::new(id) as Box<dyn rusqlite::ToSql>).collect();
            (query, params)
        }
        _ => {
            // scope = "all"
            let query = format!(
                "SELECT {} FROM candidates c
                 WHERE c.deleted_at IS NULL",
                select_columns(&config.fields)
            );
            (query, vec![])
        }
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("Failed to prepare export query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(rusqlite::params_from_iter(param_refs.into_iter()), |row| {
            let mut map = HashMap::new();
            for (idx, field) in config.fields.iter().enumerate() {
                let val: String = if field == "tags" {
                    let raw: String = row.get(idx)?;
                    // Parse JSON array and join with commas.
                    match serde_json::from_str::<Vec<String>>(&raw) {
                        Ok(arr) => arr.join(", "),
                        Err(_) => raw,
                    }
                } else if field == "createdAt" {
                    let raw: String = row.get(idx)?;
                    // Truncate to YYYY-MM-DD.
                    raw.split('T').next().unwrap_or(&raw).to_string()
                } else {
                    row.get(idx)?
                };
                map.insert(field.clone(), val);
            }
            Ok(map)
        })
        .map_err(|e| {
            let msg = format!("Failed to execute export query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect export rows: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(ExportResult {
        data: rows,
        field_order: config.field_order,
    })
}

/// Builds the SELECT column list from field keys.
fn select_columns(fields: &[String]) -> String {
    // SECURITY: whitelist of allowed export fields to prevent SQL injection
    let whitelist: std::collections::HashMap<&str, &str> = [
        ("name", "c.name"),
        ("phone", "c.phone"),
        ("email", "c.email"),
        ("currentCompany", "c.current_company"),
        ("currentPosition", "c.current_position"),
        ("education", "c.education"),
        ("yearsExp", "c.years_exp"),
        ("source", "c.source"),
        ("tags", "c.tags"),
        ("createdAt", "c.created_at"),
    ].iter().cloned().collect();

    fields
        .iter()
        .filter_map(|f| {
            if let Some(col) = whitelist.get(f.as_str()) {
                Some(col.to_string())
            } else {
                log::warn!("Skipped unknown export field: {}", f);
                None
            }
        })
        .collect::<Vec<_>>()
        .join(", ")
}
