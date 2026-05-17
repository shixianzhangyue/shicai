use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Pipeline stage entity.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStage {
    pub id: String,
    pub job_id: String,
    pub name: String,
    pub sort_order: i32,
    pub is_default: bool,
}

/// Gets all stages for a job ordered by sort_order.
#[tauri::command]
pub fn get_stages_by_job(
    state: tauri::State<DbPool>,
    job_id: String,
) -> Result<Vec<PipelineStage>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, job_id, name, sort_order, is_default FROM pipeline_stages WHERE job_id = ?1 ORDER BY sort_order ASC",
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare get_stages_by_job query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let stages = stmt
        .query_map([&job_id], |row| {
            Ok(PipelineStage {
                id: row.get(0)?,
                job_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                is_default: row.get(4)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_stages_by_job query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect stages: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(stages)
}

/// Creates a new stage for a job.
#[tauri::command]
pub fn create_stage(
    state: tauri::State<DbPool>,
    job_id: String,
    name: String,
    sort_order: i32,
) -> Result<PipelineStage, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();

    conn.execute(
        "INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default) VALUES (?1, ?2, ?3, ?4, 0)",
        params![&id, &job_id, &name, &sort_order],
    )
    .map_err(|e| {
        let msg = format!("Failed to create stage: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created stage '{}' for job {}", name, job_id);

    Ok(PipelineStage {
        id,
        job_id,
        name,
        sort_order,
        is_default: false,
    })
}

/// Updates a stage's name or sort_order.
#[tauri::command]
pub fn update_stage(
    state: tauri::State<DbPool>,
    id: String,
    name: Option<String>,
    sort_order: Option<i32>,
) -> Result<PipelineStage, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    if let Some(ref n) = name {
        conn.execute(
            "UPDATE pipeline_stages SET name = ?1 WHERE id = ?2",
            params![n, &id],
        )
        .map_err(|e| {
            let msg = format!("Failed to update stage name: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    if let Some(so) = sort_order {
        conn.execute(
            "UPDATE pipeline_stages SET sort_order = ?1 WHERE id = ?2",
            params![so, &id],
        )
        .map_err(|e| {
            let msg = format!("Failed to update stage sort_order: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    let mut stmt = conn
        .prepare(
            "SELECT id, job_id, name, sort_order, is_default FROM pipeline_stages WHERE id = ?1",
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare select stage query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let stage = stmt
        .query_row([&id], |row| {
            Ok(PipelineStage {
                id: row.get(0)?,
                job_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                is_default: row.get(4)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to get updated stage: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(stage)
}

/// Deletes a stage by ID.
#[tauri::command]
pub fn delete_stage(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute(
        "DELETE FROM pipeline_stages WHERE id = ?1",
        params![&id],
    )
    .map_err(|e| {
        let msg = format!("Failed to delete stage: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Deleted stage with id {}", id);
    Ok(())
}

/// Reorders stages for a job by updating sort_order based on the provided stage IDs order.
#[tauri::command]
pub fn reorder_stages(
    state: tauri::State<DbPool>,
    job_id: String,
    stage_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    for (index, stage_id) in stage_ids.iter().enumerate() {
        let sort_order = (index + 1) as i32;
        conn.execute(
            "UPDATE pipeline_stages SET sort_order = ?1 WHERE id = ?2 AND job_id = ?3",
            params![sort_order, stage_id, &job_id],
        )
        .map_err(|e| {
            let msg = format!("Failed to reorder stage {}: {}", stage_id, e);
            log::error!("{}", msg);
            msg
        })?;
    }

    log::info!("Reordered stages for job {}", job_id);
    Ok(())
}

/// Initializes default stages for a job.
#[tauri::command]
pub fn init_default_stages(
    state: tauri::State<DbPool>,
    job_id: String,
) -> Result<Vec<PipelineStage>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let default_stages = vec![
        ("简历筛选", 1),
        ("初试", 2),
        ("复试", 3),
        ("HR面", 4),
        ("录用", 5),
    ];

    let mut stages = Vec::new();

    for (name, sort_order) in default_stages {
        let id = nanoid::nanoid!();
        conn.execute(
            "INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default) VALUES (?1, ?2, ?3, ?4, 1)",
            params![&id, &job_id, name, &sort_order],
        )
        .map_err(|e| {
            let msg = format!("Failed to create default stage '{}': {}", name, e);
            log::error!("{}", msg);
            msg
        })?;

        stages.push(PipelineStage {
            id,
            job_id: job_id.clone(),
            name: name.to_string(),
            sort_order,
            is_default: true,
        });
    }

    log::info!("Initialized default stages for job {}", job_id);
    Ok(stages)
}

/// Pipeline entry with candidate and stage info.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineEntry {
    pub id: String,
    pub candidate_id: String,
    pub candidate_name: String,
    pub job_id: String,
    pub current_stage_id: Option<String>,
    pub current_stage_name: Option<String>,
    pub status: String,
    pub entered_at: String,
    pub updated_at: String,
    pub interview_conclusion: Option<String>,
    pub interview_notes: Option<String>,
    pub applied_at: Option<String>,
}

/// Gets all pipeline entries for a job with candidate and stage details.
#[tauri::command]
pub fn get_pipeline_by_job(
    state: tauri::State<DbPool>,
    job_id: String,
) -> Result<Vec<PipelineEntry>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT 
                cp.id, cp.candidate_id, c.name as candidate_name, cp.job_id,
                cp.current_stage_id, ps.name as stage_name, cp.status,
                cp.entered_at, cp.updated_at, cp.interview_conclusion, cp.interview_notes, cp.applied_at
            FROM candidate_pipeline cp
            JOIN candidates c ON cp.candidate_id = c.id
            LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
            WHERE cp.job_id = ?1 AND c.deleted_at IS NULL
            ORDER BY cp.updated_at DESC"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare get_pipeline_by_job query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let entries = stmt
        .query_map([&job_id], |row| {
            Ok(PipelineEntry {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                candidate_name: row.get(2)?,
                job_id: row.get(3)?,
                current_stage_id: row.get(4)?,
                current_stage_name: row.get(5)?,
                status: row.get(6)?,
                entered_at: row.get(7)?,
                updated_at: row.get(8)?,
                interview_conclusion: row.get(9)?,
                interview_notes: row.get(10)?,
                applied_at: row.get(11)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_pipeline_by_job query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect pipeline entries: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(entries)
}

/// Adds a candidate to a job (creates pipeline entry).
#[tauri::command]
pub fn add_to_job(
    state: tauri::State<DbPool>,
    candidate_id: String,
    job_id: String,
) -> Result<CandidatePipeline, String> {
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
        let msg = format!("Failed to add candidate to job: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Added candidate {} to job {}", candidate_id, job_id);

    Ok(CandidatePipeline {
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

/// Moves a candidate to a different stage.
#[tauri::command]
pub fn move_to_stage(
    state: tauri::State<DbPool>,
    pipeline_id: String,
    stage_id: String,
) -> Result<CandidatePipeline, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let now = Local::now().to_rfc3339();

    conn.execute(
        "UPDATE candidate_pipeline SET current_stage_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![&stage_id, &now, &pipeline_id],
    )
    .map_err(|e| {
        let msg = format!("Failed to move candidate to stage: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at,
                    interview_conclusion, interview_notes, applied_at
             FROM candidate_pipeline WHERE id = ?1"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare select pipeline query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let entry = stmt
        .query_row([&pipeline_id], |row| {
            Ok(CandidatePipeline {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                job_id: row.get(2)?,
                current_stage_id: row.get(3)?,
                status: row.get(4)?,
                entered_at: row.get(5)?,
                updated_at: row.get(6)?,
                interview_conclusion: row.get(7)?,
                interview_notes: row.get(8)?,
                applied_at: row.get(9)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to get updated pipeline entry: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Moved pipeline {} to stage {}", pipeline_id, stage_id);
    Ok(entry)
}

/// Rejects a candidate (marks as rejected).
#[tauri::command]
pub fn reject_candidate(
    state: tauri::State<DbPool>,
    pipeline_id: String,
) -> Result<CandidatePipeline, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let now = Local::now().to_rfc3339();

    conn.execute(
        "UPDATE candidate_pipeline SET status = 'rejected', updated_at = ?1 WHERE id = ?2",
        params![&now, &pipeline_id],
    )
    .map_err(|e| {
        let msg = format!("Failed to reject candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at,
                    interview_conclusion, interview_notes, applied_at
             FROM candidate_pipeline WHERE id = ?1"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare select pipeline query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let entry = stmt
        .query_row([&pipeline_id], |row| {
            Ok(CandidatePipeline {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                job_id: row.get(2)?,
                current_stage_id: row.get(3)?,
                status: row.get(4)?,
                entered_at: row.get(5)?,
                updated_at: row.get(6)?,
                interview_conclusion: row.get(7)?,
                interview_notes: row.get(8)?,
                applied_at: row.get(9)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to get updated pipeline entry: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Rejected candidate in pipeline {}", pipeline_id);
    Ok(entry)
}

/// Pools a candidate (marks as pooled for talent pool).
#[tauri::command]
pub fn pool_candidate(
    state: tauri::State<DbPool>,
    pipeline_id: String,
) -> Result<CandidatePipeline, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let now = Local::now().to_rfc3339();

    conn.execute(
        "UPDATE candidate_pipeline SET status = 'pooled', current_stage_id = NULL, updated_at = ?1 WHERE id = ?2",
        params![&now, &pipeline_id],
    )
    .map_err(|e| {
        let msg = format!("Failed to pool candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at,
                    interview_conclusion, interview_notes, applied_at
             FROM candidate_pipeline WHERE id = ?1"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare select pipeline query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let entry = stmt
        .query_row([&pipeline_id], |row| {
            Ok(CandidatePipeline {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                job_id: row.get(2)?,
                current_stage_id: row.get(3)?,
                status: row.get(4)?,
                entered_at: row.get(5)?,
                updated_at: row.get(6)?,
                interview_conclusion: row.get(7)?,
                interview_notes: row.get(8)?,
                applied_at: row.get(9)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to get updated pipeline entry: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Pooled candidate in pipeline {}", pipeline_id);
    Ok(entry)
}

/// Batch moves multiple candidates to a stage.
#[tauri::command]
pub fn batch_move(
    state: tauri::State<DbPool>,
    pipeline_ids: Vec<String>,
    stage_id: String,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let now = Local::now().to_rfc3339();

    for pipeline_id in &pipeline_ids {
        conn.execute(
            "UPDATE candidate_pipeline SET current_stage_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![&stage_id, &now, pipeline_id],
        )
        .map_err(|e| {
            let msg = format!("Failed to move candidate {}: {}", pipeline_id, e);
            log::error!("{}", msg);
            msg
        })?;
    }

    log::info!("Batch moved {} candidates to stage {}", pipeline_ids.len(), stage_id);
    Ok(())
}

/// Batch rejects multiple candidates.
#[tauri::command]
pub fn batch_reject(
    state: tauri::State<DbPool>,
    pipeline_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let now = Local::now().to_rfc3339();

    for pipeline_id in &pipeline_ids {
        conn.execute(
            "UPDATE candidate_pipeline SET status = 'rejected', updated_at = ?1 WHERE id = ?2",
            params![&now, pipeline_id],
        )
        .map_err(|e| {
            let msg = format!("Failed to reject candidate {}: {}", pipeline_id, e);
            log::error!("{}", msg);
            msg
        })?;
    }

    log::info!("Batch rejected {} candidates", pipeline_ids.len());
    Ok(())
}

/// Candidate pipeline entity.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidatePipeline {
    pub id: String,
    pub candidate_id: String,
    pub job_id: String,
    pub current_stage_id: Option<String>,
    pub status: String,
    pub entered_at: String,
    pub updated_at: String,
    pub interview_conclusion: Option<String>,
    pub interview_notes: Option<String>,
    pub applied_at: Option<String>,
}

/// Stage statistics for candidate module.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageStat {
    pub stage_name: String,
    pub count: i64,
}

/// Gets candidate count per stage for a job (or all jobs).
#[tauri::command]
pub fn get_candidate_stage_stats(
    state: tauri::State<DbPool>,
    job_id: Option<String>,
) -> Result<Vec<StageStat>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref jid) = job_id {
        (
            "SELECT COALESCE(ps.name, '未分配') as stage_name, COUNT(*) as count
             FROM candidate_pipeline cp
             LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             JOIN candidates c ON cp.candidate_id = c.id
             WHERE cp.status = 'active' AND c.deleted_at IS NULL AND cp.job_id = ?1
             GROUP BY ps.name
             ORDER BY MIN(ps.sort_order)".to_string(),
            vec![Box::new(jid.clone())],
        )
    } else {
        (
            "SELECT COALESCE(ps.name, '未分配') as stage_name, COUNT(*) as count
             FROM candidate_pipeline cp
             LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             JOIN candidates c ON cp.candidate_id = c.id
             WHERE cp.status = 'active' AND c.deleted_at IS NULL
             GROUP BY ps.name
             ORDER BY MIN(ps.sort_order)".to_string(),
            vec![],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("Failed to prepare get_candidate_stage_stats query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let stats = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok(StageStat {
                stage_name: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_candidate_stage_stats query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect stage stats: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(stats)
}

/// Candidate entry for candidate module with full details.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateWithPipeline {
    pub pipeline_id: String,
    pub candidate_id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
    pub years_exp: Option<i32>,
    pub age: Option<i32>,
    pub avatar_url: Option<String>,
    pub job_id: String,
    pub job_title: String,
    pub current_stage_id: Option<String>,
    pub current_stage_name: Option<String>,
    pub status: String,
    pub interview_conclusion: Option<String>,
    pub interview_notes: Option<String>,
    pub applied_at: Option<String>,
    pub updated_at: String,
}

/// Paginated result for candidate module.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedCandidateWithPipeline {
    pub items: Vec<CandidateWithPipeline>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}

/// Lists candidates with pipeline info for candidate module.
#[tauri::command]
pub fn list_candidates_by_job(
    state: tauri::State<DbPool>,
    job_id: Option<String>,
    stage_id: Option<String>,
    keyword: Option<String>,
    page: Option<i32>,
    page_size: Option<i32>,
) -> Result<PaginatedCandidateWithPipeline, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).max(1).min(100);
    let offset = (page - 1) * page_size;

    let mut conditions = vec!["cp.status = 'active'".to_string(), "c.deleted_at IS NULL".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1;

    if let Some(ref jid) = job_id {
        conditions.push(format!("cp.job_id = ?{}", param_idx));
        params.push(Box::new(jid.clone()));
        param_idx += 1;
    }

    if let Some(ref sid) = stage_id {
        conditions.push(format!("cp.current_stage_id = ?{}", param_idx));
        params.push(Box::new(sid.clone()));
        param_idx += 1;
    }

    if let Some(ref kw) = keyword {
        conditions.push(format!(
            "(c.name LIKE ?{0} OR c.phone LIKE ?{0} OR c.email LIKE ?{0} OR c.current_company LIKE ?{0})",
            param_idx
        ));
        params.push(Box::new(format!("%{}%", kw)));
    }

    let where_clause = conditions.join(" AND ");

    // Count query
    let count_sql = format!(
        "SELECT COUNT(*) FROM candidate_pipeline cp JOIN candidates c ON cp.candidate_id = c.id WHERE {}",
        where_clause
    );

    let total: i64 = conn
        .query_row(&count_sql, rusqlite::params_from_iter(params.iter()), |row| row.get(0))
        .map_err(|e| {
            let msg = format!("Failed to count candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    // Data query
    let data_sql = format!(
        "SELECT 
            cp.id as pipeline_id, c.id as candidate_id, c.name, c.phone, c.email,
            c.current_company, c.current_position, c.years_exp, c.age, c.avatar_url,
            cp.job_id, j.title as job_title,
            cp.current_stage_id, ps.name as stage_name,
            cp.status, cp.interview_conclusion, cp.interview_notes, cp.applied_at, cp.updated_at
        FROM candidate_pipeline cp
        JOIN candidates c ON cp.candidate_id = c.id
        JOIN jobs j ON cp.job_id = j.id
        LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
        WHERE {}
        ORDER BY cp.updated_at DESC
        LIMIT ?{} OFFSET ?{}",
        where_clause, param_idx, param_idx + 1
    );

    let mut params_with_limit = params;
    params_with_limit.push(Box::new(page_size));
    params_with_limit.push(Box::new(offset));

    let mut stmt = conn.prepare(&data_sql).map_err(|e| {
        let msg = format!("Failed to prepare list_candidates_by_job query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let items = stmt
        .query_map(rusqlite::params_from_iter(params_with_limit.iter()), |row| {
            Ok(CandidateWithPipeline {
                pipeline_id: row.get(0)?,
                candidate_id: row.get(1)?,
                name: row.get(2)?,
                phone: row.get(3)?,
                email: row.get(4)?,
                current_company: row.get(5)?,
                current_position: row.get(6)?,
                years_exp: row.get(7)?,
                age: row.get(8)?,
                avatar_url: row.get(9)?,
                job_id: row.get(10)?,
                job_title: row.get(11)?,
                current_stage_id: row.get(12)?,
                current_stage_name: row.get(13)?,
                status: row.get(14)?,
                interview_conclusion: row.get(15)?,
                interview_notes: row.get(16)?,
                applied_at: row.get(17)?,
                updated_at: row.get(18)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_candidates_by_job query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let total_pages = ((total as f64) / (page_size as f64)).ceil() as i32;

    Ok(PaginatedCandidateWithPipeline {
        items,
        total,
        page,
        page_size,
        total_pages,
    })
}

/// Gets unique job titles that have active candidates.
#[tauri::command]
pub fn get_jobs_with_candidates(
    state: tauri::State<DbPool>,
) -> Result<Vec<JobWithCandidateCount>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT j.id, j.title, COUNT(cp.id) as candidate_count
             FROM jobs j
             INNER JOIN candidate_pipeline cp ON cp.job_id = j.id
             INNER JOIN candidates c ON cp.candidate_id = c.id
             WHERE cp.status = 'active' AND c.deleted_at IS NULL AND j.deleted_at IS NULL
             GROUP BY j.id, j.title
             ORDER BY candidate_count DESC"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare get_jobs_with_candidates query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let jobs = stmt
        .query_map([], |row| {
            Ok(JobWithCandidateCount {
                id: row.get(0)?,
                title: row.get(1)?,
                candidate_count: row.get(2)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_jobs_with_candidates query: {}", e);
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

/// Job with candidate count for filter sidebar.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobWithCandidateCount {
    pub id: String,
    pub title: String,
    pub candidate_count: i64,
}

/// Gets candidate count grouped by stage.
/// If job_id is provided, only counts candidates for that job.
#[tauri::command]
pub fn get_stage_stats(
    state: tauri::State<DbPool>,
    job_id: Option<String>,
) -> Result<Vec<StageStat>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref jid) = job_id {
        (
            "SELECT COALESCE(ps.name, '未分配') as stage_name, COUNT(*) as cnt
             FROM candidate_pipeline cp
             LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             WHERE cp.status = 'active' AND cp.job_id = ?1
             GROUP BY stage_name
             ORDER BY MIN(ps.sort_order)".to_string(),
            vec![Box::new(jid.clone())],
        )
    } else {
        (
            "SELECT COALESCE(ps.name, '未分配') as stage_name, COUNT(*) as cnt
             FROM candidate_pipeline cp
             LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             INNER JOIN candidates c ON cp.candidate_id = c.id
             WHERE cp.status = 'active' AND c.deleted_at IS NULL
             GROUP BY stage_name
             ORDER BY MIN(ps.sort_order)".to_string(),
            vec![],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("Failed to prepare get_stage_stats query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let stats = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok(StageStat {
                stage_name: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_stage_stats query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect stage stats: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(stats)
}
