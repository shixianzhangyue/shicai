use crate::db::pool::DbPool;
use crate::services::analytics_engine;

/// Comprehensive analytics summary for the dashboard overview.
#[tauri::command]
pub fn get_analytics_summary(
    state: tauri::State<DbPool>,
) -> Result<analytics_engine::AnalyticsSummary, String> {
    analytics_engine::get_analytics_summary(&state)
}

/// Returns candidate count breakdown by source channel.
#[tauri::command]
pub fn get_source_breakdown(
    state: tauri::State<DbPool>,
) -> Result<Vec<analytics_engine::SourceBreakdownItem>, String> {
    analytics_engine::get_source_breakdown(&state)
}

/// Returns conversion funnel data across pipeline stages.
#[tauri::command]
pub fn get_conversion_funnel(
    state: tauri::State<DbPool>,
    job_id: Option<String>,
) -> Result<Vec<analytics_engine::FunnelStep>, String> {
    analytics_engine::get_conversion_funnel(&state, job_id.as_deref())
}

/// Returns daily candidate creation trend for the specified number of days.
#[tauri::command]
pub fn get_time_series(
    state: tauri::State<DbPool>,
    days: Option<i32>,
) -> Result<Vec<analytics_engine::TimeSeriesPoint>, String> {
    analytics_engine::get_time_series(&state, days.unwrap_or(30))
}

/// Returns top-performing jobs ranked by candidate conversion rate.
#[tauri::command]
pub fn get_top_performers(
    state: tauri::State<DbPool>,
    limit: Option<i32>,
) -> Result<Vec<analytics_engine::TopPerformer>, String> {
    analytics_engine::get_top_performers(&state, limit.unwrap_or(10))
}
