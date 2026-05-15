use crate::db::pool::DbPool;
use crate::validate::{CreateCandidateInput, UpdateCandidateInput, validate_input};
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Candidate entity returned by candidate commands.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
    pub education: Option<String>,
    pub years_exp: Option<i32>,
    pub source: String,
    pub tags: Vec<String>,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Queries candidates with optional multi-dimensional filters.
#[tauri::command]
pub fn list_candidates(
    state: tauri::State<DbPool>,
    keyword: Option<String>,
    tags: Option<Vec<String>>,
    education: Option<String>,
    min_exp: Option<i32>,
    max_exp: Option<i32>,
    source: Option<String>,
    include_deleted: Option<bool>,
) -> Result<Vec<Candidate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Pre-compute parameter values so references live for the entire function.
    let keyword_like = keyword.as_ref().filter(|k| !k.is_empty()).map(|k| format!("%{}%", k));
    let tag_patterns: Vec<String> = tags
        .as_ref()
        .map(|t| t.iter().map(|tag| format!("%\"{}\"%", tag)).collect())
        .unwrap_or_default();
    let education_val = education.filter(|e| !e.is_empty());
    let source_val = source.filter(|s| !s.is_empty());

    let mut conditions: Vec<String> = Vec::new();

    if include_deleted != Some(true) {
        conditions.push("deleted_at IS NULL".to_string());
    }

    if keyword_like.is_some() {
        conditions.push(
            "(name LIKE ? OR phone LIKE ? OR email LIKE ? OR current_company LIKE ? OR current_position LIKE ?)"
                .to_string(),
        );
    }

    for _ in &tag_patterns {
        conditions.push("tags LIKE ?".to_string());
    }

    if education_val.is_some() {
        conditions.push("education = ?".to_string());
    }

    if min_exp.is_some() {
        conditions.push("years_exp >= ?".to_string());
    }

    if max_exp.is_some() {
        conditions.push("years_exp <= ?".to_string());
    }

    if source_val.is_some() {
        conditions.push("source = ?".to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, name, phone, email, current_company, current_position, education, years_exp, source, tags, deleted_at, created_at, updated_at FROM candidates {} ORDER BY created_at DESC",
        where_clause
    );

    // Build parameter references in the exact order they appear in the query.
    let mut param_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();

    if let Some(ref like) = keyword_like {
        for _ in 0..5 {
            param_refs.push(like);
        }
    }

    for pattern in &tag_patterns {
        param_refs.push(pattern);
    }

    if let Some(ref edu) = education_val {
        param_refs.push(edu);
    }

    match min_exp {
        Some(ref min) => param_refs.push(min),
        None => {}
    }

    match max_exp {
        Some(ref max) => param_refs.push(max),
        None => {}
    }

    if let Some(ref src) = source_val {
        param_refs.push(src);
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("Failed to prepare list_candidates query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let candidates = stmt
        .query_map(param_refs.as_slice(), |row| {
            let tags_str: String = row.get(9)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(Candidate {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                current_company: row.get(4)?,
                current_position: row.get(5)?,
                education: row.get(6)?,
                years_exp: row.get(7)?,
                source: row.get(8)?,
                tags,
                deleted_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_candidates query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(candidates)
}

/// Queries a single candidate by its ID.
#[tauri::command]
pub fn get_candidate(state: tauri::State<DbPool>, id: String) -> Result<Candidate, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let candidate = conn
        .query_row(
            "SELECT id, name, phone, email, current_company, current_position, education, years_exp, source, tags, deleted_at, created_at, updated_at FROM candidates WHERE id = ?1 AND deleted_at IS NULL",
            params![&id],
            |row| {
                let tags_str: String = row.get(9)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                Ok(Candidate {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    phone: row.get(2)?,
                    email: row.get(3)?,
                    current_company: row.get(4)?,
                    current_position: row.get(5)?,
                    education: row.get(6)?,
                    years_exp: row.get(7)?,
                    source: row.get(8)?,
                    tags,
                    deleted_at: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to get candidate {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(candidate)
}

/// Creates a new candidate after validating input.
#[tauri::command]
pub fn create_candidate(
    state: tauri::State<DbPool>,
    input: CreateCandidateInput,
) -> Result<Candidate, String> {
    validate_input(&input)?;

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO candidates (id, name, phone, email, current_company, current_position, education, years_exp, source, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            &id,
            &input.name,
            &input.phone,
            &input.email,
            &input.current_company,
            &input.current_position,
            &input.education,
            &input.years_exp,
            &input.source,
            &tags_json,
            &now,
            &now,
        ],
    )
    .map_err(|e| {
        let msg = format!("Failed to create candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created candidate '{}' with id {}", input.name, id);

    Ok(Candidate {
        id,
        name: input.name,
        phone: input.phone,
        email: input.email,
        current_company: input.current_company,
        current_position: input.current_position,
        education: input.education,
        years_exp: input.years_exp,
        source: input.source,
        tags: input.tags,
        deleted_at: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Updates an existing candidate, only touching provided fields.
#[tauri::command]
pub fn update_candidate(
    state: tauri::State<DbPool>,
    id: String,
    input: UpdateCandidateInput,
) -> Result<Candidate, String> {
    validate_input(&input)?;

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut updates: Vec<String> = Vec::new();
    if input.name.is_some() {
        updates.push("name = ?".to_string());
    }
    if input.phone.is_some() {
        updates.push("phone = ?".to_string());
    }
    if input.email.is_some() {
        updates.push("email = ?".to_string());
    }
    if input.current_company.is_some() {
        updates.push("current_company = ?".to_string());
    }
    if input.current_position.is_some() {
        updates.push("current_position = ?".to_string());
    }
    if input.education.is_some() {
        updates.push("education = ?".to_string());
    }
    if input.years_exp.is_some() {
        updates.push("years_exp = ?".to_string());
    }
    if input.source.is_some() {
        updates.push("source = ?".to_string());
    }
    if input.tags.is_some() {
        updates.push("tags = ?".to_string());
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    updates.push("updated_at = ?".to_string());
    let sql = format!(
        "UPDATE candidates SET {} WHERE id = ? AND deleted_at IS NULL",
        updates.join(", ")
    );

    let now = Local::now().to_rfc3339();

    let mut param_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(ref v) = input.name {
        param_refs.push(v);
    }
    if let Some(ref v) = input.phone {
        param_refs.push(v);
    }
    if let Some(ref v) = input.email {
        param_refs.push(v);
    }
    if let Some(ref v) = input.current_company {
        param_refs.push(v);
    }
    if let Some(ref v) = input.current_position {
        param_refs.push(v);
    }
    if let Some(ref v) = input.education {
        param_refs.push(v);
    }
    match input.years_exp {
        Some(ref v) => param_refs.push(v),
        None => {}
    }
    if let Some(ref v) = input.source {
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
        let msg = format!("Failed to update candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let candidate = conn
        .query_row(
            "SELECT id, name, phone, email, current_company, current_position, education, years_exp, source, tags, deleted_at, created_at, updated_at FROM candidates WHERE id = ?1 AND deleted_at IS NULL",
            params![&id],
            |row| {
                let tags_str: String = row.get(9)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                Ok(Candidate {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    phone: row.get(2)?,
                    email: row.get(3)?,
                    current_company: row.get(4)?,
                    current_position: row.get(5)?,
                    education: row.get(6)?,
                    years_exp: row.get(7)?,
                    source: row.get(8)?,
                    tags,
                    deleted_at: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch updated candidate: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Updated candidate '{}' (id {})", candidate.name, candidate.id);
    Ok(candidate)
}

/// Soft-deletes a candidate and records an audit log entry.
#[tauri::command]
pub fn delete_candidate(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let candidate = conn
        .query_row(
            "SELECT id, name, phone, email, current_company, current_position, education, years_exp, source, tags, deleted_at, created_at, updated_at FROM candidates WHERE id = ?1 AND deleted_at IS NULL",
            params![&id],
            |row| {
                let tags_str: String = row.get(9)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                Ok(Candidate {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    phone: row.get(2)?,
                    email: row.get(3)?,
                    current_company: row.get(4)?,
                    current_position: row.get(5)?,
                    education: row.get(6)?,
                    years_exp: row.get(7)?,
                    source: row.get(8)?,
                    tags,
                    deleted_at: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| {
            let msg = format!("Failed to fetch candidate for deletion {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    let old_data = serde_json::to_string(&candidate).unwrap_or_else(|_| "{}".to_string());
    let now = Local::now().to_rfc3339();
    let audit_id = nanoid::nanoid!();

    conn.execute(
        "INSERT INTO audit_logs (id, table_name, record_id, action, old_data, performed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&audit_id, "candidates", &id, "soft_delete", &old_data, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to write audit log for candidate deletion {}: {}", id, e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute(
        "UPDATE candidates SET deleted_at = ?1 WHERE id = ?2",
        params![&now, &id],
    )
    .map_err(|e| {
        let msg = format!("Failed to soft-delete candidate {}: {}", id, e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Soft-deleted candidate '{}' (id {})", candidate.name, id);
    Ok(())
}
