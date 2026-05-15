use crate::db::pool::DbPool;
use rusqlite::params;
use serde::Serialize;

/// Candidate relation entity.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateRelation {
    pub id: String,
    pub candidate_id_a: String,
    pub candidate_id_b: String,
    pub relation_type: String,
    pub note: Option<String>,
    pub created_at: String,
}

/// Candidate info for relation response.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatedCandidateInfo {
    pub id: String,
    pub name: String,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
}

/// Relation with the other candidate's info.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationWithCandidate {
    pub relation: CandidateRelation,
    pub candidate: RelatedCandidateInfo,
}

/// Lists all relations for a candidate (both directions).
#[tauri::command]
pub fn list_relations(
    state: tauri::State<DbPool>,
    candidate_id: String,
) -> Result<Vec<RelationWithCandidate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT 
                r.id, r.candidate_id_a, r.candidate_id_b, r.relation_type, r.note, r.created_at,
                c.id as other_id, c.name as other_name, c.current_company, c.current_position
            FROM candidate_relations r
            JOIN candidates c ON 
                (r.candidate_id_a = ?1 AND r.candidate_id_b = c.id)
                OR (r.candidate_id_b = ?1 AND r.candidate_id_a = c.id)
            WHERE c.deleted_at IS NULL
            ORDER BY r.created_at DESC"
        )
        .map_err(|e| {
            let msg = format!("Failed to prepare list_relations query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let relations = stmt
        .query_map([&candidate_id], |row| {
            let candidate_id_a: String = row.get(1)?;
            let candidate_id_b: String = row.get(2)?;
            let other_id: String = row.get(6)?;
            
            // Determine the other candidate's id for relation struct
            let (my_id, other_id_for_struct) = if candidate_id_a == candidate_id {
                (candidate_id_a.clone(), candidate_id_b.clone())
            } else {
                (candidate_id_b.clone(), candidate_id_a.clone())
            };

            Ok(RelationWithCandidate {
                relation: CandidateRelation {
                    id: row.get(0)?,
                    candidate_id_a: my_id,
                    candidate_id_b: other_id_for_struct,
                    relation_type: row.get(3)?,
                    note: row.get(4)?,
                    created_at: row.get(5)?,
                },
                candidate: RelatedCandidateInfo {
                    id: other_id,
                    name: row.get(7)?,
                    current_company: row.get(8)?,
                    current_position: row.get(9)?,
                },
            })
        })
        .map_err(|e| {
            let msg = format!("Failed to execute list_relations query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect relations: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(relations)
}

/// Creates a new relation between two candidates.
#[tauri::command]
pub fn create_relation(
    state: tauri::State<DbPool>,
    candidate_id_a: String,
    candidate_id_b: String,
    relation_type: String,
    note: Option<String>,
) -> Result<CandidateRelation, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Prevent self-relation
    if candidate_id_a == candidate_id_b {
        return Err("不能将自己与自己建立关系".to_string());
    }

    // Check if relation already exists
    let existing: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM candidate_relations 
             WHERE ((candidate_id_a = ?1 AND candidate_id_b = ?2) 
             OR (candidate_id_a = ?2 AND candidate_id_b = ?1))",
            params![&candidate_id_a, &candidate_id_b],
            |row| row.get(0),
        )
        .map_err(|e| {
            let msg = format!("Failed to check existing relation: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    if existing > 0 {
        return Err("这两位候选人之间已存在关系".to_string());
    }

    let id = nanoid::nanoid!();
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO candidate_relations (id, candidate_id_a, candidate_id_b, relation_type, note, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&id, &candidate_id_a, &candidate_id_b, &relation_type, &note, &now],
    )
    .map_err(|e| {
        let msg = format!("Failed to create relation: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created relation between {} and {}", candidate_id_a, candidate_id_b);

    Ok(CandidateRelation {
        id,
        candidate_id_a,
        candidate_id_b,
        relation_type,
        note,
        created_at: now,
    })
}

/// Deletes a relation by ID.
#[tauri::command]
pub fn delete_relation(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    conn.execute(
        "DELETE FROM candidate_relations WHERE id = ?1",
        params![&id],
    )
    .map_err(|e| {
        let msg = format!("Failed to delete relation: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Deleted relation with id {}", id);
    Ok(())
}
