use crate::db::pool::DbPool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// Breakdown of candidates by source channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceBreakdownItem {
    pub source: String,
    pub count: i64,
    pub percentage: f64,
}

/// Conversion funnel step.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunnelStep {
    pub stage: String,
    pub count: i64,
    pub conversion_rate: f64, // percentage from previous step
}

/// Time series data point (count per time unit).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSeriesPoint {
    pub date: String,
    pub count: i64,
}

/// Top performer in pipeline metrics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopPerformer {
    pub job_id: String,
    pub job_title: String,
    pub candidate_count: i64,
    pub hired_count: i64,
    pub conversion_rate: f64,
}

/// Overall analytics summary for the dashboard.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsSummary {
    pub total_candidates: i64,
    pub total_jobs: i64,
    pub active_jobs: i64,
    pub total_pipelines: i64,
    pub hired_count: i64,
    pub pooled_count: i64,
    pub avg_days_to_hire: Option<f64>,
    pub source_breakdown: Vec<SourceBreakdownItem>,
    pub recent_trend: Vec<TimeSeriesPoint>,
}

/// Returns candidate count breakdown by source channel.
pub fn get_source_breakdown(pool: &DbPool) -> Result<Vec<SourceBreakdownItem>, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT source, COUNT(*) as cnt FROM candidates WHERE deleted_at IS NULL GROUP BY source ORDER BY cnt DESC",
        )
        .map_err(|e| format!("Failed to prepare source breakdown query: {}", e))?;

    let rows: Vec<(String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to execute source breakdown query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect source breakdown: {}", e))?;

    let total: i64 = rows.iter().map(|(_, cnt)| cnt).sum();

    let breakdown = rows
        .into_iter()
        .map(|(source, count)| SourceBreakdownItem {
            source,
            count,
            percentage: if total > 0 {
                (count as f64 / total as f64) * 100.0
            } else {
                0.0
            },
        })
        .collect();

    Ok(breakdown)
}

/// Returns conversion funnel data for a specific job or globally.
pub fn get_conversion_funnel(
    pool: &DbPool,
    job_id: Option<&str>,
) -> Result<Vec<FunnelStep>, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let base_condition = match job_id {
        Some(jid) => format!("AND cp.job_id = '{}'", jid.replace('\'', "''")),
        None => String::new(),
    };

    // Count candidates at each stage
    let count_sql = format!(
        "SELECT ps.name, COUNT(DISTINCT cp.candidate_id) as cnt \
         FROM pipeline_stages ps \
         LEFT JOIN candidate_pipeline cp ON cp.current_stage_id = ps.id {} \
         GROUP BY ps.name \
         ORDER BY ps.sort_order ASC",
        base_condition
    );

    let mut stmt = conn
        .prepare(&count_sql)
        .map_err(|e| format!("Failed to prepare funnel query: {}", e))?;

    let rows: Vec<(String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to execute funnel query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect funnel data: {}", e))?;

    let mut steps: Vec<FunnelStep> = Vec::new();
    let mut prev_count: i64 = 0;

    for (stage, count) in rows {
        let conversion_rate = if prev_count > 0 {
            (count as f64 / prev_count as f64) * 100.0
        } else {
            100.0
        };

        steps.push(FunnelStep {
            stage,
            count,
            conversion_rate,
        });

        prev_count = count;
    }

    Ok(steps)
}

/// Returns daily candidate creation counts for a given time range.
pub fn get_time_series(
    pool: &DbPool,
    days: i32,
) -> Result<Vec<TimeSeriesPoint>, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT DATE(created_at) as d, COUNT(*) as cnt \
             FROM candidates \
             WHERE deleted_at IS NULL AND DATE(created_at) >= DATE('now', ?1) \
             GROUP BY d \
             ORDER BY d ASC",
        )
        .map_err(|e| format!("Failed to prepare time series query: {}", e))?;

    let offset = format!("-{} days", days);

    let points: Vec<TimeSeriesPoint> = stmt
        .query_map(params![offset], |row| {
            Ok(TimeSeriesPoint {
                date: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to execute time series query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect time series: {}", e))?;

    Ok(points)
}

/// Returns top-performing jobs by candidate pipeline conversion rate.
pub fn get_top_performers(pool: &DbPool, limit: i32) -> Result<Vec<TopPerformer>, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT j.id, j.title, \
                    COUNT(DISTINCT cp.candidate_id) as candidate_count, \
                    COUNT(DISTINCT CASE WHEN cp.status = 'hired' THEN cp.candidate_id END) as hired_count \
             FROM jobs j \
             LEFT JOIN candidate_pipeline cp ON cp.job_id = j.id \
             WHERE j.deleted_at IS NULL \
             GROUP BY j.id \
             ORDER BY candidate_count DESC \
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare top performers query: {}", e))?;

    let performers: Vec<TopPerformer> = stmt
        .query_map(params![limit], |row| {
            let candidate_count: i64 = row.get(2)?;
            let hired_count: i64 = row.get(3)?;
            Ok(TopPerformer {
                job_id: row.get(0)?,
                job_title: row.get(1)?,
                candidate_count,
                hired_count,
                conversion_rate: if candidate_count > 0 {
                    (hired_count as f64 / candidate_count as f64) * 100.0
                } else {
                    0.0
                },
            })
        })
        .map_err(|e| format!("Failed to execute top performers query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect top performers: {}", e))?;

    Ok(performers)
}

/// Returns comprehensive analytics summary for the dashboard overview.
pub fn get_analytics_summary(pool: &DbPool) -> Result<AnalyticsSummary, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let total_candidates: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_jobs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM jobs WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let active_jobs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM jobs WHERE deleted_at IS NULL AND status = 'active'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_pipelines: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidate_pipeline",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let hired_count: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT candidate_id) FROM candidate_pipeline WHERE status = 'hired'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let pooled_count: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT candidate_id) FROM candidate_pipeline WHERE status = 'pooled'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Average days to hire (from candidate creation to pipeline entry for hired candidates)
    let avg_days_to_hire: Option<f64> = conn
        .query_row(
            "SELECT AVG(JULIANDAY(cp.updated_at) - JULIANDAY(c.created_at)) \
             FROM candidates c \
             JOIN candidate_pipeline cp ON cp.candidate_id = c.id \
             WHERE c.deleted_at IS NULL AND cp.status = 'hired'",
            [],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    let source_breakdown = get_source_breakdown(pool)?;
    let recent_trend = get_time_series(pool, 30)?;

    Ok(AnalyticsSummary {
        total_candidates,
        total_jobs,
        active_jobs,
        total_pipelines,
        hired_count,
        pooled_count,
        avg_days_to_hire,
        source_breakdown,
        recent_trend,
    })
}
