use crate::db::pool::DbPool;
use chrono::{Datelike, Duration, Local};
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
    /// Total headcount across all open jobs.
    pub total_headcount: i64,
    /// Number of candidates that reached the final pipeline stage.
    pub hired_count: i64,
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

    // 3. Talent pool size (all active candidates)
    let talent_pool_size: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL",
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

    // 5. Total headcount across open jobs
    let total_headcount: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(headcount), 0) FROM jobs WHERE status = 'open' AND deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            let msg = format!("Failed to count total headcount: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    // 6. Hired count — candidates in the final pipeline stage of each job
    let hired_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidate_pipeline cp
             JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             WHERE cp.status = 'active'
               AND ps.sort_order = (
                   SELECT MAX(ps2.sort_order)
                   FROM pipeline_stages ps2
                   WHERE ps2.job_id = ps.job_id
               )",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            let msg = format!("Failed to count hired candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(OverviewStats {
        open_jobs,
        total_candidates,
        talent_pool_size,
        today_follow_ups,
        total_headcount,
        hired_count,
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

/// Recent activity item returned by `get_recent_activity`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentActivity {
    pub id: String,
    pub activity_type: String,
    pub title: String,
    pub description: String,
    pub created_at: String,
}

/// Returns recent activity from pipeline audit log and follow-ups.
#[tauri::command]
pub fn get_recent_activity(
    state: tauri::State<DbPool>,
    limit: Option<i64>,
) -> Result<Vec<RecentActivity>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let limit = limit.unwrap_or(10);

    // Get recent pipeline audit log entries
    let audit_sql = "SELECT pal.id, pal.action, pal.action_detail, pal.created_at,
                     c.name as candidate_name, j.title as job_title
                     FROM pipeline_audit_log pal
                     LEFT JOIN candidates c ON pal.candidate_id = c.id
                     LEFT JOIN jobs j ON pal.job_id = j.id
                     ORDER BY pal.created_at DESC
                     LIMIT ?1";

    let mut activities: Vec<RecentActivity> = Vec::new();

    let audit_rows = conn
        .prepare(audit_sql)
        .map_err(|e| {
            let msg = format!("Failed to prepare audit query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .query_map(params![limit], |row| {
            let action: String = row.get(1)?;
            let detail: Option<String> = row.get(2)?;
            let created_at: String = row.get(3)?;
            let candidate_name: Option<String> = row.get(4)?;
            let job_title: Option<String> = row.get(5)?;

            let (activity_type, title, description) = match action.as_str() {
                "enter_job" => (
                    "join".to_string(),
                    format!("{} 加入了流程", candidate_name.unwrap_or_default()),
                    job_title.unwrap_or_default(),
                ),
                "leave_job" => (
                    "leave".to_string(),
                    format!("{} 离开了流程", candidate_name.unwrap_or_default()),
                    job_title.unwrap_or_default(),
                ),
                "reject" => (
                    "reject".to_string(),
                    format!("{} 被淘汰", candidate_name.unwrap_or_default()),
                    detail.unwrap_or_default(),
                ),
                "pool" => (
                    "pool".to_string(),
                    format!("{} 入库", candidate_name.unwrap_or_default()),
                    detail.unwrap_or_default(),
                ),
                _ => (
                    "other".to_string(),
                    action,
                    detail.unwrap_or_default(),
                ),
            };

            Ok(RecentActivity {
                id: row.get(0)?,
                activity_type,
                title,
                description,
                created_at,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute audit query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect audit data: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    activities.extend(audit_rows);

    // Sort by created_at descending
    activities.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    activities.truncate(limit as usize);

    Ok(activities)
}

/// Trend data returned by `get_trend_data`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendData {
    pub candidates_this_week: i64,
    pub candidates_last_week: i64,
    pub interviews_this_week: i64,
    pub interviews_last_week: i64,
    pub hired_this_week: i64,
    pub hired_last_week: i64,
}

/// Returns week-over-week trend data for the dashboard.
///
/// - "this week" = Monday 00:00 to now
/// - "last week" = Monday before that to Sunday 23:59:59
/// - candidates: count from `candidates.created_at`
/// - interviews: pipeline entries in interview stages, counted by `candidate_pipeline.updated_at`
/// - hired: pipeline entries in the final stage, counted by `candidate_pipeline.updated_at`
#[tauri::command]
pub fn get_trend_data(state: tauri::State<DbPool>) -> Result<TrendData, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let now = Local::now();
    let today = now.date_naive();

    // Calculate Monday of this week (ISO weekday: Monday = 1)
    let days_since_monday = today.weekday().num_days_from_monday();
    let this_monday = today - Duration::days(days_since_monday as i64);
    let last_monday = this_monday - Duration::days(7);
    let last_sunday = this_monday - Duration::days(1);

    // Build ISO datetime strings for SQL comparisons
    let this_week_start = format!("{} 00:00:00", this_monday);
    let last_week_start = format!("{} 00:00:00", last_monday);
    let last_week_end = format!("{} 23:59:59", last_sunday);

    // 1. Candidates created this week vs last week
    let candidates_this_week: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL AND created_at >= ?1",
            params![&this_week_start],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count candidates this week: {}", e))?;

    let candidates_last_week: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL AND created_at >= ?1 AND created_at <= ?2",
            params![&last_week_start, &last_week_end],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count candidates last week: {}", e))?;

    // 2. Interviews — pipeline entries currently in an interview stage, counted by updated_at
    //    Interview stages are those whose name contains '面试'
    let interviews_this_week: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidate_pipeline cp
             JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             WHERE cp.status = 'active'
               AND ps.name LIKE '%面试%'
               AND cp.updated_at >= ?1",
            params![&this_week_start],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count interviews this week: {}", e))?;

    let interviews_last_week: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidate_pipeline cp
             JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             WHERE cp.status = 'active'
               AND ps.name LIKE '%面试%'
               AND cp.updated_at >= ?1
               AND cp.updated_at <= ?2",
            params![&last_week_start, &last_week_end],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count interviews last week: {}", e))?;

    // 3. Hired — pipeline entries in the final stage of each job, counted by updated_at
    let hired_this_week: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidate_pipeline cp
             JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             WHERE cp.status = 'active'
               AND ps.sort_order = (
                   SELECT MAX(ps2.sort_order)
                   FROM pipeline_stages ps2
                   WHERE ps2.job_id = ps.job_id
               )
               AND cp.updated_at >= ?1",
            params![&this_week_start],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count hired this week: {}", e))?;

    let hired_last_week: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidate_pipeline cp
             JOIN pipeline_stages ps ON cp.current_stage_id = ps.id
             WHERE cp.status = 'active'
               AND ps.sort_order = (
                   SELECT MAX(ps2.sort_order)
                   FROM pipeline_stages ps2
                   WHERE ps2.job_id = ps.job_id
               )
               AND cp.updated_at >= ?1
               AND cp.updated_at <= ?2",
            params![&last_week_start, &last_week_end],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count hired last week: {}", e))?;

    Ok(TrendData {
        candidates_this_week,
        candidates_last_week,
        interviews_this_week,
        interviews_last_week,
        hired_this_week,
        hired_last_week,
    })
}
