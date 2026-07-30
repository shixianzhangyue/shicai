use super::PipelineStage;
use crate::db::pool::DbPool;
use rusqlite::params;

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
        ("面试", 2),
        ("Offer沟通", 3),
        ("已入职", 4),
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
