use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Follow-up entity.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUp {
    pub id: String,
    pub candidate_id: String,
    pub content: String,
    pub follow_type: String,
    pub result: Option<String>,
    pub next_follow_date: Option<String>,
    pub related_job_id: Option<String>,
    pub created_at: String,
}

/// Candidate info for follow-up with candidate.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateInfo {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
}

/// Follow-up with candidate details.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUpWithCandidate {
    pub id: String,
    pub candidate_id: String,
    pub candidate_name: String,
    pub content: String,
    pub follow_type: String,
    pub result: Option<String>,
    pub next_follow_date: Option<String>,
    pub related_job_id: Option<String>,
    pub created_at: String,
}

/// Lists all follow-ups for a candidate.
#[tauri::command]
pub fn list_follow_ups(
    state: tauri::State<DbPool>,
    candidate_id: String,
) -> Result<Vec<FollowUp>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, candidate_id, content, follow_type, result, next_follow_date, related_job_id, created_at 
             FROM follow_ups WHERE candidate_id = ?1 ORDER BY created_at DESC"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare list_follow_ups query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let follow_ups = stmt
        .query_map([&candidate_id], |row| {
            Ok(FollowUp {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                content: row.get(2)?,
                follow_type: row.get(3)?,
                result: row.get(4)?,
                next_follow_date: row.get(5)?,
                related_job_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_follow_ups query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect follow-ups: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(follow_ups)
}

/// Creates a new follow-up for a candidate.
#[tauri::command]
pub fn create_follow_up(
    state: tauri::State<DbPool>,
    candidate_id: String,
    content: String,
    follow_type: String,
    result: Option<String>,
    next_follow_date: Option<String>,
    related_job_id: Option<String>,
) -> Result<FollowUp, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO follow_ups (id, candidate_id, content, follow_type, result, next_follow_date, related_job_id, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![&id, &candidate_id, &content, &follow_type, &result, &next_follow_date, &related_job_id, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to create follow-up: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created follow-up for candidate {}", candidate_id);

    Ok(FollowUp {
        id,
        candidate_id,
        content,
        follow_type,
        result,
        next_follow_date,
        related_job_id,
        created_at: now,
    })
}

/// Deletes a follow-up by ID.
#[tauri::command]
pub fn delete_follow_up(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute(
        "DELETE FROM follow_ups WHERE id = ?1",
        params![&id],
    )
    .map_err(|e| {
        let msg = format!("Failed to delete follow-up: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Deleted follow-up with id {}", id);
    Ok(())
}

/// Gets today's follow-ups (where next_follow_date is today or past).
#[tauri::command]
pub fn get_today_follow_ups(
    state: tauri::State<DbPool>,
) -> Result<Vec<FollowUpWithCandidate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let today = Local::now().format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT 
                fu.id, fu.candidate_id, c.name as candidate_name, fu.content,
                fu.follow_type, fu.result, fu.next_follow_date, fu.related_job_id, fu.created_at
            FROM follow_ups fu
            JOIN candidates c ON fu.candidate_id = c.id
            WHERE fu.next_follow_date <= ?1 AND c.deleted_at IS NULL
            ORDER BY fu.next_follow_date ASC, fu.created_at DESC"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare get_today_follow_ups query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let follow_ups = stmt
        .query_map([&today], |row| {
            Ok(FollowUpWithCandidate {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                candidate_name: row.get(2)?,
                content: row.get(3)?,
                follow_type: row.get(4)?,
                result: row.get(5)?,
                next_follow_date: row.get(6)?,
                related_job_id: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute get_today_follow_ups query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect today's follow-ups: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(follow_ups)
}
