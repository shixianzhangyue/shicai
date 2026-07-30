use super::write_audit_log;
use crate::db::pool::DbPool;
use chrono::Local;
use rusqlite::params;

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

    // Wrap in transaction for atomicity
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
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
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            log::info!("Batch moved {} candidates to stage {}", pipeline_ids.len(), stage_id);
            Ok(())
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            Err(e)
        }
    }
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

    // Wrap in transaction for atomicity
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        for pipeline_id in &pipeline_ids {
            // Get candidate_id and job_id before update
            let cid_jid: Result<(String, Option<String>), _> = conn
                .query_row(
                    "SELECT candidate_id, job_id FROM candidate_pipeline WHERE id = ?1",
                    [pipeline_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                );
            if let Ok((c_id, j_id)) = cid_jid {
                conn.execute(
                    "UPDATE candidate_pipeline SET status = 'rejected', updated_at = ?1 WHERE id = ?2",
                    params![&now, pipeline_id],
                )
                .map_err(|e| {
                    let msg = format!("Failed to reject candidate {}: {}", pipeline_id, e);
                    log::error!("{}", msg);
                    msg
                })?;
                // Write audit log: reject
                let _ = write_audit_log(&conn, &c_id, pipeline_id, j_id.as_deref(), "reject", None);
            }
        }
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            log::info!("Batch rejected {} candidates", pipeline_ids.len());
            Ok(())
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            Err(e)
        }
    }
}
