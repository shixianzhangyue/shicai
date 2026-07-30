mod batch;
mod entries;
mod stages;
mod stats;

pub use batch::*;
pub use entries::*;
pub use stages::*;
pub use stats::*;

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

/// Audit log entry for pipeline key events.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogEntry {
    pub id: String,
    pub candidate_id: String,
    pub pipeline_id: String,
    pub job_id: Option<String>,
    pub job_title: Option<String>,
    pub action: String,
    pub action_detail: Option<String>,
    pub created_at: String,
}

/// Pipeline entry with candidate and stage info.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineEntry {
    pub id: String,
    pub candidate_id: String,
    pub candidate_name: String,
    pub job_id: Option<String>,
    pub job_title: Option<String>,
    pub current_stage_id: Option<String>,
    pub current_stage_name: Option<String>,
    pub status: String,
    pub entered_at: String,
    pub updated_at: String,
    pub interview_conclusion: Option<String>,
    pub interview_notes: Option<String>,
    pub applied_at: Option<String>,
}

/// Candidate pipeline entity.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidatePipeline {
    pub id: String,
    pub candidate_id: String,
    pub job_id: Option<String>,
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
    pub job_id: Option<String>,
    pub job_title: Option<String>,
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

/// Job with candidate count for filter sidebar.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobWithCandidateCount {
    pub id: String,
    pub title: String,
    pub candidate_count: i64,
}

/// Writes an audit log entry to pipeline_audit_log.
pub(super) fn write_audit_log(
    conn: &rusqlite::Connection,
    candidate_id: &str,
    pipeline_id: &str,
    job_id: Option<&str>,
    action: &str,
    action_detail: Option<&str>,
) -> Result<(), String> {
    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO pipeline_audit_log (id, candidate_id, pipeline_id, job_id, action, action_detail, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&id, candidate_id, pipeline_id, job_id, action, action_detail, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to write audit log: {}", e);
        log::error!("{}", msg);
        msg
    })?;
    Ok(())
}
