use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Overview statistics returned by `get_overview_stats`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewStats {
    /// Number of jobs with status = 'open' and not soft-deleted.
    pub open_jobs: i64,
    /// Total number of candidates not soft-deleted.
    pub total_candidates: i64,
    /// Number of candidates in the talent pool (status = 'pooled').
    pub talent_pool_size: i64,
    /// Number of follow-ups scheduled for today or earlier.
    pub today_follow_ups: i64,
}

/// Funnel data item returned by `get_funnel_data`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FunnelData {
    pub job_id: String,
    pub job_title: String,
    pub stage_name: String,
    pub count: i64,
}

/// Returns high-level dashboard statistics.
///
/// Queries:
/// - Open jobs count (status = 'open', deleted_at IS NULL)
/// - Total candidates (deleted_at IS NULL)
/// - Talent pool size (candidate_pipeline.status = 'pooled')
/// - Today's follow-ups (next_follow_date <= today)
#[tauri::command]
pub fn get_overview_stats(state: tauri::State<DbPool>) -> Result<OverviewStats, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let today = Local::now().format("%Y-%m-%d").to_string();

    // 1. Open jobs count
    let open_jobs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM jobs WHERE status = 'open' AND deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            let msg = format!("Failed to count open jobs: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    // 2. Total candidates
    let total_candidates: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            let msg = format!("Failed to count candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    // 3. Talent pool size (candidates with at least one pooled pipeline entry)
    let talent_pool_size: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT candidate_id) FROM candidate_pipeline WHERE status = 'pooled'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            let msg = format!("Failed to count talent pool: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    // 4. Today's follow-ups (next_follow_date <= today)
    let today_follow_ups: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM follow_ups WHERE next_follow_date IS NOT NULL AND next_follow_date <= ?1",
            params![&today],
            |row| row.get(0),
        )
        .map_err(|e| {
            let msg = format!("Failed to count today's follow-ups: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(OverviewStats {
        open_jobs,
        total_candidates,
        talent_pool_size,
        today_follow_ups,
    })
}

/// Returns funnel data grouped by job and stage.
///
/// If `job_id` is `None`, returns data for all jobs.
/// If `job_id` is `Some`, returns data for the specific job only.
#[tauri::command]
pub fn get_funnel_data(
    state: tauri::State<DbPool>,
    job_id: Option<String>,
) -> Result<Vec<FunnelData>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let sql = if job_id.is_some() {
        "SELECT j.id, j.title, ps.name, COUNT(cp.id) as cnt
         FROM jobs j
         JOIN pipeline_stages ps ON ps.job_id = j.id
         LEFT JOIN candidate_pipeline cp ON cp.current_stage_id = ps.id AND cp.status = 'active'
         WHERE j.deleted_at IS NULL AND j.id = ?1
         GROUP BY j.id, ps.id
         ORDER BY j.title, ps.sort_order"
    } else {
        "SELECT j.id, j.title, ps.name, COUNT(cp.id) as cnt
         FROM jobs j
         JOIN pipeline_stages ps ON ps.job_id = j.id
         LEFT JOIN candidate_pipeline cp ON cp.current_stage_id = ps.id AND cp.status = 'active'
         WHERE j.deleted_at IS NULL
         GROUP BY j.id, ps.id
         ORDER BY j.title, ps.sort_order"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| {
        let msg = format!("Failed to prepare funnel query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let rows = if let Some(ref jid) = job_id {
        stmt.query_map(params![jid], |row| {
            Ok(FunnelData {
                job_id: row.get(0)?,
                job_title: row.get(1)?,
                stage_name: row.get(2)?,
                count: row.get(3)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute funnel query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect funnel data: {}", e);
            log::error!("{}", msg);
            msg
        })?
    } else {
        stmt.query_map([], |row| {
            Ok(FunnelData {
                job_id: row.get(0)?,
                job_title: row.get(1)?,
                stage_name: row.get(2)?,
                count: row.get(3)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute funnel query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect funnel data: {}", e);
            log::error!("{}", msg);
            msg
        })?
    };

    Ok(rows)
}
