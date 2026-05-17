use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Talent pool entry with candidate info.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TalentEntry {
    pub candidate_id: String,
    pub candidate_name: String,
    pub candidate_phone: Option<String>,
    pub candidate_email: Option<String>,
    pub original_job_id: Option<String>,
    pub original_job_title: Option<String>,
    pub pooled_at: String,
}

/// Lists all pooled (rejected) candidates with optional filters.
#[tauri::command]
pub fn list_talent_pool(
    state: tauri::State<DbPool>,
    keyword: Option<String>,
    tags: Option<Vec<String>>,
    source: Option<String>,
    original_job_id: Option<String>,
) -> Result<Vec<TalentEntry>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut sql = String::from(
        "SELECT DISTINCT 
            c.id as candidate_id, c.name as candidate_name, c.phone, c.email,
            cp.job_id as original_job_id, j.title as original_job_title,
            cp.updated_at as pooled_at
        FROM candidate_pipeline cp
        JOIN candidates c ON cp.candidate_id = c.id
        LEFT JOIN jobs j ON cp.job_id = j.id
        WHERE cp.status = 'rejected' AND c.deleted_at IS NULL"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(kw) = keyword.filter(|k| !k.is_empty()) {
        sql.push_str(" AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)");
        let like = format!("%{}%", kw);
        params_vec.push(Box::new(like.clone()));
        params_vec.push(Box::new(like.clone()));
        params_vec.push(Box::new(like));
    }

    if let Some(job_id) = original_job_id.filter(|j| !j.is_empty()) {
        sql.push_str(" AND cp.job_id = ?");
        params_vec.push(Box::new(job_id));
    }

    if let Some(src) = source.filter(|s| !s.is_empty()) {
        sql.push_str(" AND c.source = ?");
        params_vec.push(Box::new(src));
    }

    // Tags filter requires JSON array matching
    if let Some(tag_list) = tags.filter(|t| !t.is_empty()) {
        for tag in tag_list {
            sql.push_str(" AND c.tags LIKE ?");
            params_vec.push(Box::new(format!("%\"{}\"%", tag)));
        }
    }

    sql.push_str(" ORDER BY cp.updated_at DESC");

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|p| p.as_ref())
        .collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("Failed to prepare list_talent_pool query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let entries = stmt
        .query_map(rusqlite::params_from_iter(param_refs), |row| {
            Ok(TalentEntry {
                candidate_id: row.get(0)?,
                candidate_name: row.get(1)?,
                candidate_phone: row.get(2)?,
                candidate_email: row.get(3)?,
                original_job_id: row.get(4)?,
                original_job_title: row.get(5)?,
                pooled_at: row.get(6)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_talent_pool query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect talent pool entries: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(entries)
}

/// Reactivates a pooled candidate by creating a new pipeline entry for a job.
#[tauri::command]
pub fn reactivate_candidate(
    state: tauri::State<DbPool>,
    candidate_id: String,
    job_id: String,
) -> Result<crate::commands::pipeline::CandidatePipeline, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();

    // Get first stage for the job
    let first_stage: Option<String> = conn
        .query_row(
            "SELECT id FROM pipeline_stages WHERE job_id = ?1 ORDER BY sort_order ASC LIMIT 1",
            [&job_id],
            |row| row.get(0),
        )
        .ok();

    conn.execute(
        "INSERT INTO candidate_pipeline (id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5)",
        params![&id, &candidate_id, &job_id, &first_stage, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to reactivate candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Reactivated candidate {} for job {}", candidate_id, job_id);

    Ok(crate::commands::pipeline::CandidatePipeline {
        id,
        candidate_id,
        job_id,
        current_stage_id: first_stage,
        status: "active".to_string(),
        entered_at: now.clone(),
        updated_at: now,
        interview_conclusion: None,
        interview_notes: None,
        applied_at: None,
    })
}

/// Checks for duplicate candidates by phone or email.
#[tauri::command]
pub fn check_duplicate(
    state: tauri::State<DbPool>,
    phone: Option<String>,
    email: Option<String>,
) -> Result<Vec<crate::commands::candidates::Candidate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut sql = String::from(
        "SELECT id, name, phone, email, current_company, current_position, education, years_exp, source, tags, deleted_at, created_at, updated_at 
         FROM candidates WHERE deleted_at IS NULL AND ("
    );
    let mut conditions = Vec::new();
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(p) = phone.filter(|p| !p.is_empty()) {
        if p.len() == 4 {
            // Phone last 4 digits match
            conditions.push("phone LIKE ?".to_string());
            params_vec.push(format!("%{}%", p));
        } else {
            conditions.push("phone = ?".to_string());
            params_vec.push(p);
        }
    }

    if let Some(e) = email.filter(|e| !e.is_empty()) {
        if !conditions.is_empty() {
            sql.push_str(" OR ");
        }
        conditions.push("email = ?".to_string());
        params_vec.push(e);
    }

    if conditions.is_empty() {
        return Ok(Vec::new());
    }

    sql.push_str(&conditions.join(" OR "));
    sql.push_str(")");

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|p| p as &dyn rusqlite::ToSql)
        .collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("Failed to prepare check_duplicate query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let candidates = stmt
        .query_map(rusqlite::params_from_iter(param_refs), |row| {
            Ok(crate::commands::candidates::Candidate {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                current_company: row.get(4)?,
                current_position: row.get(5)?,
                education: row.get(6)?,
                years_exp: row.get(7)?,
                source: row.get(8)?,
                tags: {
                    let tags_json: String = row.get(9)?;
                    serde_json::from_str(&tags_json).unwrap_or_default()
                },
                in_talent_pool: true,
                deleted_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                // V8 fields — defaults since this query doesn't select these columns
                gender: None,
                birth_date: None,
                expected_city: None,
                expected_salary: None,
                graduation_date: None,
                school: None,
                major: None,
                is_starred: false,
                is_hidden: false,
                work_experiences: "[]".to_string(),
                education_history: "[]".to_string(),
                source_detail: None,
                avatar_url: None,
                age: None,
                last_active_at: None,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute check_duplicate query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect duplicate candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(candidates)
}

/// Search index item for quick lookup.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateSearchIndex {
    pub id: String,
    pub name: String,
    pub phone_last4: Option<String>,
}

/// Returns lightweight search index for all candidates.
#[tauri::command]
pub fn get_candidate_search_index(
    state: tauri::State<DbPool>,
) -> Result<Vec<CandidateSearchIndex>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone FROM candidates WHERE deleted_at IS NULL"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare get_candidate_search_index query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let index = stmt
        .query_map([], |row| {
            let phone: Option<String> = row.get(2)?;
            let phone_last4 = phone.as_ref().and_then(|p| {
                if p.len() >= 4 {
                    Some(p[p.len() - 4..].to_string())
                } else {
                    None
                }
            });
            Ok(CandidateSearchIndex {
                id: row.get(0)?,
                name: row.get(1)?,
                phone_last4,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_candidate_search_index query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect search index: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(index)
}
