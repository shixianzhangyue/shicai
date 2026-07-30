use super::{
    write_audit_log, AuditLogEntry, CandidatePipeline, PipelineEntry,
};
use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;

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
                cp.id, cp.candidate_id, c.name as candidate_name, cp.job_id, j.title as job_title,
                cp.current_stage_id, ps.name as stage_name, cp.status,
                cp.entered_at, cp.updated_at, cp.interview_conclusion, cp.interview_notes, cp.applied_at
            FROM candidate_pipeline cp
            JOIN candidates c ON cp.candidate_id = c.id
            LEFT JOIN jobs j ON cp.job_id = j.id
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
            let job_id: Option<String> = row.get(3)?;
            let job_title: Option<String> = row.get(4)?;
            let current_stage_id: Option<String> = row.get(5)?;
            let current_stage_name: Option<String> = row.get(6)?;
            let interview_conclusion: Option<String> = row.get(10)?;
            let interview_notes: Option<String> = row.get(11)?;
            let applied_at: Option<String> = row.get(12)?;
            Ok(PipelineEntry {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                candidate_name: row.get(2)?,
                job_id,
                job_title,
                current_stage_id,
                current_stage_name,
                status: row.get(7)?,
                entered_at: row.get(8)?,
                updated_at: row.get(9)?,
                interview_conclusion,
                interview_notes,
                applied_at,
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

/// Gets all pipeline entries for a candidate with job and stage details.
#[tauri::command]
pub fn get_pipeline_by_candidate(
    state: tauri::State<DbPool>,
    candidate_id: String,
) -> Result<Vec<PipelineEntry>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT
                cp.id, cp.candidate_id, c.name as candidate_name, cp.job_id, j.title as job_title,
                cp.current_stage_id, ps.name as stage_name, cp.status,
                cp.entered_at, cp.updated_at, cp.interview_conclusion, cp.interview_notes, cp.applied_at
            FROM candidate_pipeline cp
            JOIN candidates c ON cp.candidate_id = c.id
            LEFT JOIN jobs j ON cp.job_id = j.id
            LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
            WHERE cp.candidate_id = ?1 AND c.deleted_at IS NULL
            ORDER BY cp.updated_at DESC"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare get_pipeline_by_candidate query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let entries = stmt
        .query_map([&candidate_id], |row| {
            let job_id: Option<String> = row.get(3)?;
            let job_title: Option<String> = row.get(4)?;
            let current_stage_id: Option<String> = row.get(5)?;
            let current_stage_name: Option<String> = row.get(6)?;
            let interview_conclusion: Option<String> = row.get(10)?;
            let interview_notes: Option<String> = row.get(11)?;
            let applied_at: Option<String> = row.get(12)?;
            Ok(PipelineEntry {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                candidate_name: row.get(2)?,
                job_id,
                job_title,
                current_stage_id,
                current_stage_name,
                status: row.get(7)?,
                entered_at: row.get(8)?,
                updated_at: row.get(9)?,
                interview_conclusion,
                interview_notes,
                applied_at,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_pipeline_by_candidate query: {}", e);
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

    // Check for existing active pipeline entry to prevent duplicates
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM candidate_pipeline WHERE candidate_id = ?1 AND job_id = ?2 AND status = 'active' LIMIT 1",
            [&candidate_id, &job_id],
            |row| row.get(0),
        )
        .ok();

    if existing.is_some() {
        return Err("该候选人已在此职位的流程中".to_string());
    }

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

    // Write audit log: enter_job
    let _ = write_audit_log(&conn, &candidate_id, &id, Some(&job_id), "enter_job", None);

    log::info!("Added candidate {} to job {}", candidate_id, job_id);

    Ok(CandidatePipeline {
        id,
        candidate_id,
        job_id: Some(job_id),
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

    // Get pipeline info before update (for audit log)
    let (c_id, j_id): (String, Option<String>) = conn
        .query_row(
            "SELECT candidate_id, job_id FROM candidate_pipeline WHERE id = ?1",
            [&pipeline_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Pipeline entry not found: {}", e))?;

    conn.execute(
        "UPDATE candidate_pipeline SET status = 'rejected', updated_at = ?1 WHERE id = ?2",
        params![&now, &pipeline_id],
    )
    .map_err(|e| {
        let msg = format!("Failed to reject candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Write audit log: reject
    let _ = write_audit_log(&conn, &c_id, &pipeline_id, j_id.as_deref(), "reject", None);

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

    // Get pipeline info before update (for audit log)
    let (c_id, j_id): (String, Option<String>) = conn
        .query_row(
            "SELECT candidate_id, job_id FROM candidate_pipeline WHERE id = ?1",
            [&pipeline_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Pipeline entry not found: {}", e))?;

    conn.execute(
        "UPDATE candidate_pipeline SET status = 'pooled', current_stage_id = NULL, updated_at = ?1 WHERE id = ?2",
        params![&now, &pipeline_id],
    )
    .map_err(|e| {
        let msg = format!("Failed to pool candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Write audit log: pool
    let _ = write_audit_log(&conn, &c_id, &pipeline_id, j_id.as_deref(), "pool", None);

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

/// Removes a candidate from a job (deletes the candidate_pipeline entry)
/// and writes a 'leave_job' audit log entry.
#[tauri::command]
pub fn remove_from_job(
    state: tauri::State<DbPool>,
    pipeline_id: String,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Get candidate_id and job_id before deletion
    let (c_id, j_id): (String, Option<String>) = conn
        .query_row(
            "SELECT candidate_id, job_id FROM candidate_pipeline WHERE id = ?1",
            [&pipeline_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Pipeline entry not found: {}", e))?;

    conn.execute(
        "DELETE FROM candidate_pipeline WHERE id = ?1",
        params![&pipeline_id],
    )
    .map_err(|e| {
        let msg = format!("Failed to remove candidate from job: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Write audit log: leave_job
    let _ = write_audit_log(&conn, &c_id, &pipeline_id, j_id.as_deref(), "leave_job", None);

    log::info!("Removed pipeline entry {} (candidate {} from job {:?})", pipeline_id, c_id, j_id);
    Ok(())
}

/// Gets audit log entries for a candidate, ordered by created_at DESC.
#[tauri::command]
pub fn get_audit_log(
    state: tauri::State<DbPool>,
    candidate_id: String,
) -> Result<Vec<AuditLogEntry>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT al.id, al.candidate_id, al.pipeline_id, al.job_id, j.title as job_title,
                    al.action, al.action_detail, al.created_at
             FROM pipeline_audit_log al
             LEFT JOIN jobs j ON al.job_id = j.id
             WHERE al.candidate_id = ?1
             ORDER BY al.created_at DESC"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare get_audit_log query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let entries = stmt
        .query_map([&candidate_id], |row| {
            Ok(AuditLogEntry {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                pipeline_id: row.get(2)?,
                job_id: row.get(3)?,
                job_title: row.get(4)?,
                action: row.get(5)?,
                action_detail: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_audit_log query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect audit log entries: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(entries)
}
