use crate::db::pool::DbPool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// A pair of candidates flagged as potential duplicates.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicatePair {
    pub candidate_a_id: String,
    pub candidate_a_name: String,
    pub candidate_b_id: String,
    pub candidate_b_name: String,
    pub match_reasons: Vec<String>,
    pub confidence: f64, // 0.0 ~ 1.0
}

/// Result of a merge preview operation, showing what the merged candidate would look like.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergePreview {
    pub primary_id: String,
    pub primary_name: String,
    pub secondary_id: String,
    pub secondary_name: String,
    pub merged_fields: Vec<MergedField>,
    pub tags_union: Vec<String>,
    pub resumes_kept: i32,
}

/// A single field comparison during merge preview.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergedField {
    pub field_name: String,
    pub primary_value: Option<String>,
    pub secondary_value: Option<String>,
    pub chosen_value: Option<String>,
    pub source: String, // "primary", "secondary", or "union"
}

/// Minimum confidence threshold to flag as potential duplicate.
const DUPLICATE_THRESHOLD: f64 = 0.6;

/// Phone normalization: strip spaces, dashes, parentheses, leading +86.
fn normalize_phone(phone: &str) -> String {
    let stripped: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if stripped.len() > 11 {
        stripped[stripped.len() - 11..].to_string()
    } else {
        stripped
    }
}

/// Email normalization: lowercase and trim.
fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

/// Computes similarity between two strings using Jaccard character 3-gram index.
fn string_similarity(a: &str, b: &str) -> f64 {
    if a == b {
        return 1.0;
    }
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }

    let a_lower = a.to_lowercase();
    let b_lower = b.to_lowercase();

    let a_trigrams: std::collections::HashSet<String> = a_lower
        .char_indices()
        .filter_map(|(i, _)| {
            if i + 3 <= a_lower.len() {
                Some(a_lower[i..i + 3].to_string())
            } else {
                None
            }
        })
        .collect();

    let b_trigrams: std::collections::HashSet<String> = b_lower
        .char_indices()
        .filter_map(|(i, _)| {
            if i + 3 <= b_lower.len() {
                Some(b_lower[i..i + 3].to_string())
            } else {
                None
            }
        })
        .collect();

    if a_trigrams.is_empty() || b_trigrams.is_empty() {
        return 0.0;
    }

    let intersection = a_trigrams.intersection(&b_trigrams).count();
    let union = a_trigrams.union(&b_trigrams).count();

    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

/// Detects potential duplicates among all non-deleted candidates.
pub fn detect_duplicates(pool: &DbPool) -> Result<Vec<DuplicatePair>, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    // Fetch all non-deleted candidates (limited to 5000 for performance)
    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone, email, current_company, current_position, education, school, major FROM candidates WHERE deleted_at IS NULL LIMIT 5000",
        )
        .map_err(|e| format!("Failed to prepare duplicate detection query: {}", e))?;

    #[derive(Debug, Clone)]
    struct CandidateBrief {
        id: String,
        name: String,
        phone: Option<String>,
        email: Option<String>,
        company: Option<String>,
        position: Option<String>,
        education: Option<String>,
        school: Option<String>,
        major: Option<String>,
    }

    let candidates: Vec<CandidateBrief> = stmt
        .query_map([], |row| {
            Ok(CandidateBrief {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                company: row.get(4)?,
                position: row.get(5)?,
                education: row.get(6)?,
                school: row.get(7)?,
                major: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query candidates: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect candidates: {}", e))?;

    let mut pairs: Vec<DuplicatePair> = Vec::new();

    // O(n^2) pairwise comparison — acceptable for desktop app with < 5000 candidates
    for i in 0..candidates.len() {
        for j in (i + 1)..candidates.len() {
            let a = &candidates[i];
            let b = &candidates[j];
            let mut match_reasons: Vec<String> = Vec::new();
            let mut total_score: f64 = 0.0;
            let mut score_count: f64 = 0.0;

            // Exact phone match (weight: 0.4)
            if let (Some(ref pa), Some(ref pb)) = (&a.phone, &b.phone) {
                if !pa.is_empty() && !pb.is_empty() {
                    if normalize_phone(pa) == normalize_phone(pb) {
                        match_reasons.push("手机完全匹配".to_string());
                        total_score += 0.4;
                    }
                }
            }
            score_count += 0.4;

            // Exact email match (weight: 0.35)
            if let (Some(ref ea), Some(ref eb)) = (&a.email, &b.email) {
                if !ea.is_empty() && !eb.is_empty() {
                    if normalize_email(ea) == normalize_email(eb) {
                        match_reasons.push("邮箱完全匹配".to_string());
                        total_score += 0.35;
                    }
                }
            }
            score_count += 0.35;

            // Name similarity (weight: 0.25)
            let name_sim = string_similarity(&a.name, &b.name);
            if name_sim >= 0.8 {
                match_reasons.push(format!("姓名高度相似 ({:.0}%)", name_sim * 100.0));
                total_score += 0.25 * name_sim;
            }
            score_count += 0.25;

            let confidence = if score_count > 0.0 {
                total_score / score_count
            } else {
                0.0
            };

            if confidence >= DUPLICATE_THRESHOLD && !match_reasons.is_empty() {
                pairs.push(DuplicatePair {
                    candidate_a_id: a.id.clone(),
                    candidate_a_name: a.name.clone(),
                    candidate_b_id: b.id.clone(),
                    candidate_b_name: b.name.clone(),
                    match_reasons,
                    confidence,
                });
            }
        }
    }

    // Sort by confidence descending
    pairs.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));

    Ok(pairs)
}

/// Generates a merge preview showing what the combined candidate would look like.
pub fn preview_merge(
    pool: &DbPool,
    primary_id: &str,
    secondary_id: &str,
) -> Result<MergePreview, String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;

    let columns = "id, name, phone, email, current_company, current_position, education, years_exp, source, tags, gender, birth_date, expected_city, expected_salary, graduation_date, school, major, source_detail, work_experiences, education_history";

    let primary = conn
        .query_row(
            &format!("SELECT {} FROM candidates WHERE id = ?1 AND deleted_at IS NULL", columns),
            params![primary_id],
            |row| Ok(extract_candidate_fields(row)),
        )
        .map_err(|e| format!("Primary candidate not found: {}", e))?;

    let secondary = conn
        .query_row(
            &format!("SELECT {} FROM candidates WHERE id = ?1 AND deleted_at IS NULL", columns),
            params![secondary_id],
            |row| Ok(extract_candidate_fields(row)),
        )
        .map_err(|e| format!("Secondary candidate not found: {}", e))?;

    let field_names = [
        "name", "phone", "email", "current_company", "current_position",
        "education", "years_exp", "source", "gender", "birth_date",
        "expected_city", "expected_salary", "graduation_date", "school",
        "major", "source_detail",
    ];

    let mut merged_fields = Vec::new();
    for (idx, field_name) in field_names.iter().enumerate() {
        let p_val = primary[idx].clone();
        let s_val = secondary[idx].clone();

        let (chosen, source) = match (&p_val, &s_val) {
            (Some(p), Some(s)) => {
                if p == s {
                    (Some(p.clone()), "primary")
                } else {
                    (Some(format!("{} | {}", p, s)), "union")
                }
            }
            (Some(p), None) => (Some(p.clone()), "primary"),
            (None, Some(s)) => (Some(s.clone()), "secondary"),
            (None, None) => (None, "primary"),
        };

        merged_fields.push(MergedField {
            field_name: field_name.to_string(),
            primary_value: p_val,
            secondary_value: s_val,
            chosen_value: chosen,
            source: source.to_string(),
        });
    }

    // Merge tags (union)
    let primary_tags_str = &primary[9]; // tags index
    let secondary_tags_str = &secondary[9];

    let primary_tags: Vec<String> = primary_tags_str
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();
    let secondary_tags: Vec<String> = secondary_tags_str
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let mut tags_union: Vec<String> = primary_tags;
    for tag in secondary_tags {
        if !tags_union.contains(&tag) {
            tags_union.push(tag);
        }
    }

    // Count resumes that would be kept
    let primary_resumes: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM resumes WHERE candidate_id = ?1 AND deleted_at IS NULL",
            params![primary_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(MergePreview {
        primary_id: primary_id.to_string(),
        primary_name: primary[0].clone().unwrap_or_default(),
        secondary_id: secondary_id.to_string(),
        secondary_name: secondary[0].clone().unwrap_or_default(),
        merged_fields,
        tags_union,
        resumes_kept: primary_resumes,
    })
}

/// Extracts candidate field values by column index for merge comparison.
fn extract_candidate_fields(row: &rusqlite::Row) -> Vec<Option<String>> {
    vec![
        row.get::<_, Option<String>>(1).ok().flatten(),  // name
        row.get::<_, Option<String>>(2).ok().flatten(),  // phone
        row.get::<_, Option<String>>(3).ok().flatten(),  // email
        row.get::<_, Option<String>>(4).ok().flatten(),  // current_company
        row.get::<_, Option<String>>(5).ok().flatten(),  // current_position
        row.get::<_, Option<String>>(6).ok().flatten(),  // education
        row.get::<_, Option<i32>>(7).ok().flatten().map(|v| v.to_string()),  // years_exp
        row.get::<_, Option<String>>(9).ok().flatten(),  // source (index 8 is source but we need tags at 9)
        row.get::<_, Option<String>>(10).ok().flatten(), // gender
        row.get::<_, Option<String>>(11).ok().flatten(), // birth_date
        row.get::<_, Option<String>>(12).ok().flatten(), // expected_city
        row.get::<_, Option<String>>(13).ok().flatten(), // expected_salary
        row.get::<_, Option<String>>(14).ok().flatten(), // graduation_date
        row.get::<_, Option<String>>(15).ok().flatten(), // school
        row.get::<_, Option<String>>(16).ok().flatten(), // major
        row.get::<_, Option<String>>(17).ok().flatten(), // source_detail
    ]
}

/// Merges two candidates: moves resumes/logs to primary, soft-deletes secondary.
pub fn merge_candidates(
    pool: &DbPool,
    primary_id: &str,
    secondary_id: &str,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| format!("Failed to get DB connection: {}", e))?;
    let now = chrono::Local::now().to_rfc3339();

    // Wrap all merge operations in a transaction for data consistency
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let merge_result = (|| -> Result<(), String> {
    // Move resumes from secondary to primary
    conn.execute(
        "UPDATE resumes SET candidate_id = ?1 WHERE candidate_id = ?2 AND deleted_at IS NULL",
        params![primary_id, secondary_id],
    )
    .map_err(|e| format!("Failed to move resumes: {}", e))?;

    // Move portfolios from secondary to primary
    conn.execute(
        "UPDATE portfolios SET candidate_id = ?1 WHERE candidate_id = ?2",
        params![primary_id, secondary_id],
    )
    .map_err(|e| format!("Failed to move portfolios: {}", e))?;

    // Move follow-ups from secondary to primary
    conn.execute(
        "UPDATE follow_ups SET candidate_id = ?1 WHERE candidate_id = ?2",
        params![primary_id, secondary_id],
    )
    .map_err(|e| format!("Failed to move follow-ups: {}", e))?;

    // Move candidate relations from secondary to primary
    conn.execute(
        "UPDATE candidate_relations SET candidate_id = ?1 WHERE candidate_id = ?2",
        params![primary_id, secondary_id],
    )
    .map_err(|e| format!("Failed to move candidate relations: {}", e))?;

    // Merge tags from secondary into primary
    let secondary_tags: String = conn
        .query_row(
            "SELECT tags FROM candidates WHERE id = ?1",
            params![secondary_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "[]".to_string());

    let primary_tags: String = conn
        .query_row(
            "SELECT tags FROM candidates WHERE id = ?1",
            params![primary_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "[]".to_string());

    let mut tags: Vec<String> = serde_json::from_str(&primary_tags).unwrap_or_default();
    let secondary_tags_vec: Vec<String> = serde_json::from_str(&secondary_tags).unwrap_or_default();
    for tag in secondary_tags_vec {
        if !tags.contains(&tag) {
            tags.push(tag);
        }
    }
    let merged_tags = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());

    // Update primary candidate's tags
    conn.execute(
        "UPDATE candidates SET tags = ?1, updated_at = ?2 WHERE id = ?3",
        params![&merged_tags, &now, primary_id],
    )
    .map_err(|e| format!("Failed to merge tags: {}", e))?;

    // Write audit log for the merge
    let audit_id = nanoid::nanoid!();
    let audit_data = serde_json::json!({
        "action": "merge_candidates",
        "primary_id": primary_id,
        "secondary_id": secondary_id,
    });
    conn.execute(
        "INSERT INTO audit_logs (id, table_name, record_id, action, old_data, performed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&audit_id, "candidates", primary_id, "merge", audit_data.to_string(), &now],
    )
    .map_err(|e| format!("Failed to write audit log: {}", e))?;

    // Soft-delete the secondary candidate
    conn.execute(
        "UPDATE candidates SET deleted_at = ?1 WHERE id = ?2",
        params![&now, secondary_id],
    )
    .map_err(|e| format!("Failed to soft-delete secondary candidate: {}", e))?;

    log::info!(
        "Merged candidate {} into {}",
        secondary_id,
        primary_id
    );

    Ok(())
    })(); // End of merge closure

    // Commit or rollback based on result
    match merge_result {
        Ok(()) => {
            conn.execute("COMMIT", [])
                .map_err(|e| format!("Failed to commit transaction: {}", e))?;
            Ok(())
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            Err(e)
        }
    }
}
