use crate::db::pool::DbPool;
use crate::validate::{CreateJobInput, UpdateJobInput, validate_input};
use chrono::Local;
use rusqlite::params;
use serde::Serialize;
use serde_json;

/// Job entity returned by job commands.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub title: String,
    pub department: Option<String>,
    pub salary_min: Option<f64>,
    pub salary_max: Option<f64>,
    pub description: Option<String>,
    pub requirements: Option<String>,
    pub status: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Queries all non-deleted jobs ordered by creation time (newest first).
#[tauri::command]
pub fn list_jobs(state: tauri::State<DbPool>) -> Result<Vec<Job>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, department, salary_min, salary_max, description, requirements, status, tags, created_at, updated_at FROM jobs WHERE deleted_at IS NULL ORDER BY created_at DESC",
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare list_jobs query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let jobs = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(Job {
                id: row.get(0)?,
                title: row.get(1)?,
                department: row.get(2)?,
                salary_min: row.get(3)?,
                salary_max: row.get(4)?,
                description: row.get(5)?,
                requirements: row.get(6)?,
                status: row.get(7)?,
                tags,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_jobs query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect jobs: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(jobs)
}

/// Queries a single non-deleted job by its ID.
#[tauri::command]
pub fn get_job(state: tauri::State<DbPool>, id: String) -> Result<Job, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let job = conn
        .query_row(
            "SELECT id, title, department, salary_min, salary_max, description, requirements, status, tags, created_at, updated_at FROM jobs WHERE id = ?1 AND deleted_at IS NULL",
            params![&id],
            |row| {
                let tags_str: String = row.get(8)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                Ok(Job {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    department: row.get(2)?,
                    salary_min: row.get(3)?,
                    salary_max: row.get(4)?,
                    description: row.get(5)?,
                    requirements: row.get(6)?,
                    status: row.get(7)?,
                    tags,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to get job {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(job)
}

/// Creates a new job after validating input.
#[tauri::command]
pub fn create_job(
    state: tauri::State<DbPool>,
    input: CreateJobInput,
) -> Result<Job, String> {
    validate_input(&input)?;

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();
    let tags_json = serde_json::to_string(&input.tags)
        .unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO jobs (id, title, department, salary_min, salary_max, description, requirements, status, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            &id,
            &input.title,
            &input.department,
            &input.salary_min,
            &input.salary_max,
            &input.description,
            &input.requirements,
            &input.status,
            &tags_json,
            &now,
            &now,
        ],
    )
    .map_err(|e| {
        let msg = format!("Failed to create job: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created job '{}' with id {}", input.title, id);

    Ok(Job {
        id,
        title: input.title,
        department: input.department,
        salary_min: input.salary_min,
        salary_max: input.salary_max,
        description: input.description,
        requirements: input.requirements,
        status: input.status,
        tags: input.tags,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Updates an existing job, only touching provided fields.
#[tauri::command]
pub fn update_job(
    state: tauri::State<DbPool>,
    id: String,
    input: UpdateJobInput,
) -> Result<Job, String> {
    validate_input(&input)?;

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Build dynamic update query based on provided fields.
    let mut updates: Vec<String> = Vec::new();
    if input.title.is_some() {
        updates.push("title = ?".to_string());
    }
    if input.department.is_some() {
        updates.push("department = ?".to_string());
    }
    if input.salary_min.is_some() {
        updates.push("salary_min = ?".to_string());
    }
    if input.salary_max.is_some() {
        updates.push("salary_max = ?".to_string());
    }
    if input.description.is_some() {
        updates.push("description = ?".to_string());
    }
    if input.requirements.is_some() {
        updates.push("requirements = ?".to_string());
    }
    if input.status.is_some() {
        updates.push("status = ?".to_string());
    }
    if input.tags.is_some() {
        updates.push("tags = ?".to_string());
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    updates.push("updated_at = ?".to_string());
    let sql = format!("UPDATE jobs SET {} WHERE id = ? AND deleted_at IS NULL", updates.join(", "));

    let now = Local::now().to_rfc3339();

    // Collect parameters in the correct order.
    let mut param_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(ref v) = input.title {
        param_refs.push(v);
    }
    if let Some(ref v) = input.department {
        param_refs.push(v);
    }
    if let Some(v) = input.salary_min {
        param_refs.push(&v);
    }
    if let Some(v) = input.salary_max {
        param_refs.push(&v);
    }
    if let Some(ref v) = input.description {
        param_refs.push(v);
    }
    if let Some(ref v) = input.requirements {
        param_refs.push(v);
    }
    if let Some(ref v) = input.status {
        param_refs.push(v);
    }
    let tags_json;
    if let Some(ref v) = input.tags {
        tags_json = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        param_refs.push(&tags_json);
    }
    param_refs.push(&now);
    param_refs.push(&id);

    conn.execute(&sql, param_refs.as_slice()).map_err(|e| {
        let msg = format!("Failed to update job: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Fetch the updated job.
    let job = conn
        .query_row(
            "SELECT id, title, department, salary_min, salary_max, description, requirements, status, tags, created_at, updated_at FROM jobs WHERE id = ?1 AND deleted_at IS NULL",
            params![&id],
            |row| {
                let tags_str: String = row.get(8)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                Ok(Job {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    department: row.get(2)?,
                    salary_min: row.get(3)?,
                    salary_max: row.get(4)?,
                    description: row.get(5)?,
                    requirements: row.get(6)?,
                    status: row.get(7)?,
                    tags,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch updated job: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Updated job '{}' (id {})", job.title, job.id);
    Ok(job)
}

/// Soft-deletes a job and records an audit log entry.
#[tauri::command]
pub fn delete_job(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Fetch the record to snapshot for the audit log.
    let job = conn
        .query_row(
            "SELECT id, title, department, salary_min, salary_max, description, requirements, status, tags, created_at, updated_at FROM jobs WHERE id = ?1 AND deleted_at IS NULL",
            params![&id],
            |row| {
                let tags_str: String = row.get(8)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                Ok(Job {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    department: row.get(2)?,
                    salary_min: row.get(3)?,
                    salary_max: row.get(4)?,
                    description: row.get(5)?,
                    requirements: row.get(6)?,
                    status: row.get(7)?,
                    tags,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch job for deletion {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    let old_data = serde_json::to_string(&job).unwrap_or_else(|_| "{}".to_string());
    let now = Local::now().to_rfc3339();
    let audit_id = nanoid::nanoid!();

    conn.execute(
        "INSERT INTO audit_logs (id, table_name, record_id, action, old_data, performed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&audit_id, "jobs", &id, "soft_delete", &old_data, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to write audit log for job deletion {}: {}", id, e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute(
        "UPDATE jobs SET deleted_at = ?1 WHERE id = ?2",
        params![&now, &id],
    )
    .map_err(|e| {
        let msg = format!("Failed to soft-delete job {}: {}", id, e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Soft-deleted job '{}' (id {})", job.title, id);
    Ok(())
}

/// Duplicates an existing job with a new ID and title suffix.
#[tauri::command]
pub fn duplicate_job(state: tauri::State<DbPool>, id: String) -> Result<Job, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let original = conn
        .query_row(
            "SELECT id, title, department, salary_min, salary_max, description, requirements, status, tags, created_at, updated_at FROM jobs WHERE id = ?1 AND deleted_at IS NULL",
            params![&id],
            |row| {
                let tags_str: String = row.get(8)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                Ok(Job {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    department: row.get(2)?,
                    salary_min: row.get(3)?,
                    salary_max: row.get(4)?,
                    description: row.get(5)?,
                    requirements: row.get(6)?,
                    status: row.get(7)?,
                    tags,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch job for duplication {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    let new_id = nanoid::nanoid!();
    let new_title = format!("{}（副本）", original.title);
    let now = Local::now().to_rfc3339();
    let tags_json = serde_json::to_string(&original.tags).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO jobs (id, title, department, salary_min, salary_max, description, requirements, status, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            &new_id,
            &new_title,
            &original.department,
            &original.salary_min,
            &original.salary_max,
            &original.description,
            &original.requirements,
            "draft",
            &tags_json,
            &now,
            &now,
        ],
    )
    .map_err(|e| {
        let msg = format!("Failed to duplicate job: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Duplicated job '{}' -> '{}' (id {})", original.title, new_title, new_id);

    Ok(Job {
        id: new_id,
        title: new_title,
        department: original.department,
        salary_min: original.salary_min,
        salary_max: original.salary_max,
        description: original.description,
        requirements: original.requirements,
        status: "draft".to_string(),
        tags: original.tags,
        created_at: now.clone(),
        updated_at: now,
    })
}
