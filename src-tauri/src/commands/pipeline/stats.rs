use super::{CandidateWithPipeline, JobWithCandidateCount, PaginatedCandidateWithPipeline, StageStat};
use crate::db::pool::DbPool;

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

/// Lists candidates with pipeline info for candidate module.
#[tauri::command]
pub fn list_candidates_by_job(
    state: tauri::State<DbPool>,
    job_id: Option<String>,
    stage_id: Option<String>,
    stage_name: Option<String>,
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
    } else if let Some(ref sname) = stage_name {
        // Filter by stage name via JOIN
        conditions.push(format!("ps.name = ?{}", param_idx));
        params.push(Box::new(sname.clone()));
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
        "SELECT COUNT(*) FROM candidate_pipeline cp
         JOIN candidates c ON cp.candidate_id = c.id
         LEFT JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
         WHERE {}",
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
        LEFT JOIN jobs j ON cp.job_id = j.id
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

    // Query from pipeline_stages to ensure ALL stages appear, even with 0 candidates
    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref jid) = job_id {
        (
            "SELECT ps.name as stage_name, COUNT(cp.id) as cnt
             FROM pipeline_stages ps
             LEFT JOIN candidate_pipeline cp ON cp.current_stage_id = ps.id AND cp.status = 'active'
             LEFT JOIN candidates c ON cp.candidate_id = c.id AND c.deleted_at IS NULL
             WHERE ps.job_id = ?1
             GROUP BY ps.name
             ORDER BY ps.sort_order".to_string(),
            vec![Box::new(jid.clone())],
        )
    } else {
        // All jobs: aggregate by stage name across all jobs
        (
            "SELECT ps.name as stage_name, COUNT(cp.id) as cnt
             FROM pipeline_stages ps
             LEFT JOIN candidate_pipeline cp ON cp.current_stage_id = ps.id AND cp.status = 'active'
             LEFT JOIN candidates c ON cp.candidate_id = c.id AND c.deleted_at IS NULL
             GROUP BY ps.name
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
