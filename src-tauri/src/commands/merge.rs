use crate::db::pool::DbPool;
use crate::services::duplicate_detector;

/// Duplicate candidate pair returned by detection.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateCandidate {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
}

/// A detected duplicate pair with match reasons and confidence.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateDetectionResult {
    pub pair_a: DuplicateCandidate,
    pub pair_b: DuplicateCandidate,
    pub match_reasons: Vec<String>,
    pub confidence: f64,
}

/// Preview of what a merge operation would produce.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergePreviewResult {
    pub primary: DuplicateCandidate,
    pub secondary: DuplicateCandidate,
    pub merged_tags: Vec<String>,
    pub field_changes: Vec<FieldChange>,
}

/// A single field change in a merge preview.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub field: String,
    pub from_primary: Option<String>,
    pub from_secondary: Option<String>,
    pub result_value: Option<String>,
}

/// Runs duplicate detection across all candidates and returns flagged pairs.
#[tauri::command]
pub fn detect_duplicates(
    state: tauri::State<DbPool>,
) -> Result<Vec<DuplicateDetectionResult>, String> {
    let pairs = duplicate_detector::detect_duplicates(&state)?;

    let conn = state.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let mut results = Vec::new();

    for pair in pairs {
        // Fetch candidate A details
        let a = conn.query_row(
            "SELECT name, phone, email FROM candidates WHERE id = ?1 AND deleted_at IS NULL",
            rusqlite::params![pair.candidate_a_id],
            |row| {
                Ok(DuplicateCandidate {
                    id: pair.candidate_a_id.clone(),
                    name: row.get(0)?,
                    phone: row.get(1)?,
                    email: row.get(2)?,
                })
            },
        );
        let a = match a {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Fetch candidate B details
        let b = conn.query_row(
            "SELECT name, phone, email FROM candidates WHERE id = ?1 AND deleted_at IS NULL",
            rusqlite::params![pair.candidate_b_id],
            |row| {
                Ok(DuplicateCandidate {
                    id: pair.candidate_b_id.clone(),
                    name: row.get(0)?,
                    phone: row.get(1)?,
                    email: row.get(2)?,
                })
            },
        );
        let b = match b {
            Ok(c) => c,
            Err(_) => continue,
        };

        results.push(DuplicateDetectionResult {
            pair_a: a,
            pair_b: b,
            match_reasons: pair.match_reasons,
            confidence: pair.confidence,
        });
    }

    Ok(results)
}

/// Generates a preview of what merging two candidates would look like.
#[tauri::command]
pub fn preview_merge(
    state: tauri::State<DbPool>,
    primary_id: String,
    secondary_id: String,
) -> Result<MergePreviewResult, String> {
    let preview = duplicate_detector::preview_merge(&state, &primary_id, &secondary_id)?;

    let conn = state.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let primary = conn.query_row(
        "SELECT name, phone, email FROM candidates WHERE id = ?1",
        rusqlite::params![primary_id],
        |row| {
            Ok(DuplicateCandidate {
                id: primary_id.clone(),
                name: row.get(0)?,
                phone: row.get(1)?,
                email: row.get(2)?,
            })
        },
    ).map_err(|e| format!("Primary candidate not found: {}", e))?;

    let secondary = conn.query_row(
        "SELECT name, phone, email FROM candidates WHERE id = ?1",
        rusqlite::params![secondary_id],
        |row| {
            Ok(DuplicateCandidate {
                id: secondary_id.clone(),
                name: row.get(0)?,
                phone: row.get(1)?,
                email: row.get(2)?,
            })
        },
    ).map_err(|e| format!("Secondary candidate not found: {}", e))?;

    let field_changes: Vec<FieldChange> = preview
        .merged_fields
        .into_iter()
        .map(|f| FieldChange {
            field: f.field_name,
            from_primary: f.primary_value,
            from_secondary: f.secondary_value,
            result_value: f.chosen_value,
        })
        .collect();

    Ok(MergePreviewResult {
        primary,
        secondary,
        merged_tags: preview.tags_union,
        field_changes,
    })
}

/// Performs the actual merge of two candidates.
/// The primary candidate survives; the secondary is soft-deleted.
/// All associated data (resumes, portfolios, follow-ups) is transferred to the primary.
#[tauri::command]
pub fn merge_candidates(
    state: tauri::State<DbPool>,
    primary_id: String,
    secondary_id: String,
) -> Result<(), String> {
    if primary_id == secondary_id {
        return Err("不能合并同一个候选人".to_string());
    }

    duplicate_detector::merge_candidates(&state, &primary_id, &secondary_id)?;

    log::info!(
        "Merged candidates: primary={}, secondary={}",
        primary_id,
        secondary_id
    );

    Ok(())
}
