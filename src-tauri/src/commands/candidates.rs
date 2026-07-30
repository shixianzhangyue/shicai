use crate::db::pool::DbPool;
use crate::validate::{CreateCandidateInput, UpdateCandidateInput, validate_input};
use chrono::Local;
use rusqlite::params;
use serde::Serialize;

/// Candidate entity returned by candidate commands.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
    pub education: Option<String>,
    pub years_exp: Option<i32>,
    pub source: String,
    pub tags: Vec<String>,
    pub in_talent_pool: bool,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    // V8 enhanced fields
    pub gender: Option<String>,
    pub birth_date: Option<String>,
    pub expected_city: Option<String>,
    pub expected_salary: Option<String>,
    pub graduation_date: Option<String>,
    pub school: Option<String>,
    pub major: Option<String>,
    pub is_starred: bool,
    pub is_hidden: bool,
    pub work_experiences: String,
    pub education_history: String,
    pub source_detail: Option<String>,
    // V12 enhanced fields
    pub avatar_url: Option<String>,
    pub age: Option<i32>,
    pub last_active_at: Option<String>,
}

/// Paginated result wrapper.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedCandidates {
    pub items: Vec<Candidate>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}

/// Shared column list for all candidate SELECT queries.
/// Keeps indices stable across list, get, update, and delete queries.
const CANDIDATE_COLUMNS: &str = "c.id, c.name, c.phone, c.email, c.current_company, c.current_position, c.education, c.years_exp, c.source, c.tags, c.deleted_at, c.created_at, c.updated_at, EXISTS (SELECT 1 FROM candidate_pipeline cp WHERE cp.candidate_id = c.id AND cp.status = 'pooled') as in_pool, c.gender, c.birth_date, c.expected_city, c.expected_salary, c.graduation_date, c.school, c.major, c.is_starred, c.is_hidden, c.work_experiences, c.education_history, c.source_detail, c.avatar_url, c.age, c.last_active_at";

/// Maps a rusqlite Row to a Candidate struct.
/// Columns are fetched by name so that inserting/reordering a column in
/// CANDIDATE_COLUMNS cannot silently shift every index and corrupt the mapping.
fn map_candidate(row: &rusqlite::Row) -> rusqlite::Result<Candidate> {
    let tags_str: String = row.get("tags")?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    let in_pool: bool = row.get("in_pool")?;
    let is_starred_raw: i32 = row.get("is_starred")?;
    let is_hidden_raw: i32 = row.get("is_hidden")?;
    Ok(Candidate {
        id: row.get("id")?,
        name: row.get("name")?,
        phone: row.get("phone")?,
        email: row.get("email")?,
        current_company: row.get("current_company")?,
        current_position: row.get("current_position")?,
        education: row.get("education")?,
        years_exp: row.get("years_exp")?,
        source: row.get("source")?,
        tags,
        in_talent_pool: in_pool,
        deleted_at: row.get("deleted_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        gender: row.get("gender")?,
        birth_date: row.get("birth_date")?,
        expected_city: row.get("expected_city")?,
        expected_salary: row.get("expected_salary")?,
        graduation_date: row.get("graduation_date")?,
        school: row.get("school")?,
        major: row.get("major")?,
        is_starred: is_starred_raw != 0,
        is_hidden: is_hidden_raw != 0,
        work_experiences: row.get("work_experiences")?,
        education_history: row.get("education_history")?,
        source_detail: row.get("source_detail")?,
        avatar_url: row.get("avatar_url")?,
        age: row.get("age")?,
        last_active_at: row.get("last_active_at")?,
    })
}

/// Queries candidates with optional multi-dimensional filters and pagination.
#[tauri::command]
pub fn list_candidates(
    state: tauri::State<DbPool>,
    keyword: Option<String>,
    tags: Option<Vec<String>>,
    education: Option<String>,
    min_exp: Option<i32>,
    max_exp: Option<i32>,
    source: Option<String>,
    in_talent_pool: Option<bool>,
    school: Option<String>,
    expected_city: Option<String>,
    gender: Option<String>,
    is_starred: Option<bool>,
    exclude_active_pipeline: Option<bool>,
    page: Option<i32>,
    page_size: Option<i32>,
    sort_by: Option<String>,
    sort_order: Option<String>,
    include_deleted: Option<bool>,
) -> Result<PaginatedCandidates, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let current_page = page.unwrap_or(1).max(1);
    let size = page_size.unwrap_or(20).max(1).min(100);
    let offset = (current_page - 1) * size;

    // Pre-compute parameter values so references live for the entire function.
    // Escape LIKE wildcards to prevent injection
    let keyword_like = keyword.as_ref().filter(|k| !k.is_empty()).map(|k| {
        let escaped = k.replace('%', "\\%").replace('_', "\\_");
        format!("%{}%", escaped)
    });
    let tag_patterns: Vec<String> = tags
        .as_ref()
        .map(|t| t.iter().map(|tag| {
            let escaped = tag.replace('%', "\\%").replace('_', "\\_");
            format!("%\"{}\"%", escaped)
        }).collect())
        .unwrap_or_default();
    let education_val = education.filter(|e| !e.is_empty());
    let source_val = source.filter(|s| !s.is_empty());
    let school_val = school.filter(|s| !s.is_empty());
    let city_val = expected_city.filter(|c| !c.is_empty());
    let gender_val = gender.filter(|g| !g.is_empty());

    let mut conditions: Vec<String> = Vec::new();

    if include_deleted != Some(true) {
        conditions.push("c.deleted_at IS NULL".to_string());
    }

    if keyword_like.is_some() {
        conditions.push(
            "(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.current_company LIKE ? OR c.current_position LIKE ? OR c.school LIKE ?)"
                .to_string(),
        );
    }

    for _ in &tag_patterns {
        conditions.push("c.tags LIKE ?".to_string());
    }

    if education_val.is_some() {
        conditions.push("c.education = ?".to_string());
    }

    if min_exp.is_some() {
        conditions.push("c.years_exp >= ?".to_string());
    }

    if max_exp.is_some() {
        conditions.push("c.years_exp <= ?".to_string());
    }

    if source_val.is_some() {
        conditions.push("c.source = ?".to_string());
    }

    if school_val.is_some() {
        conditions.push("c.school = ?".to_string());
    }

    if city_val.is_some() {
        conditions.push("c.expected_city = ?".to_string());
    }

    if gender_val.is_some() {
        conditions.push("c.gender = ?".to_string());
    }

    if is_starred == Some(true) {
        conditions.push("c.is_starred = 1".to_string());
    }

    // Talent pool filter: check if candidate has pooled status in any pipeline
    if in_talent_pool == Some(true) {
        conditions.push(
            "EXISTS (SELECT 1 FROM candidate_pipeline cp WHERE cp.candidate_id = c.id AND cp.status = 'pooled')"
                .to_string(),
        );
    }

    // Exclude candidates who are in active pipeline (for talent pool view)
    if exclude_active_pipeline == Some(true) {
        conditions.push(
            "NOT EXISTS (SELECT 1 FROM candidate_pipeline cp WHERE cp.candidate_id = c.id AND cp.status = 'active')"
                .to_string(),
        );
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Sort configuration
    let allowed_sort_fields = ["name", "created_at", "updated_at", "years_exp", "education", "school", "expected_city"];
    let sort_field = sort_by
        .filter(|s| allowed_sort_fields.contains(&s.as_str()))
        .unwrap_or_else(|| "created_at".to_string());
    let order = match sort_order.as_deref() {
        Some("asc") => "ASC",
        _ => "DESC",
    };

    // Count total records
    let count_sql = format!(
        "SELECT COUNT(*) FROM candidates c {}",
        where_clause
    );

    let mut count_stmt = conn.prepare(&count_sql).map_err(|e| {
        let msg = format!("Failed to prepare count query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut count_params: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(ref like) = keyword_like {
        for _ in 0..6 {
            count_params.push(like);
        }
    }
    for pattern in &tag_patterns {
        count_params.push(pattern);
    }
    if let Some(ref edu) = education_val {
        count_params.push(edu);
    }
    if let Some(ref min) = min_exp {
        count_params.push(min);
    }
    if let Some(ref max) = max_exp {
        count_params.push(max);
    }
    if let Some(ref src) = source_val {
        count_params.push(src);
    }
    if let Some(ref s) = school_val {
        count_params.push(s);
    }
    if let Some(ref c) = city_val {
        count_params.push(c);
    }
    if let Some(ref g) = gender_val {
        count_params.push(g);
    }

    let total: i64 = count_stmt.query_row(count_params.as_slice(), |row| row.get(0)).map_err(|e| {
        let msg = format!("Failed to count candidates: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let total_pages = ((total as f64) / (size as f64)).ceil() as i32;

    // Query paginated results
    let sql = format!(
        "SELECT {} FROM candidates c {} ORDER BY c.{} {} LIMIT ? OFFSET ?",
        CANDIDATE_COLUMNS, where_clause, sort_field, order
    );

    // Build parameter references in the exact order they appear in the query.
    let mut param_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();

    if let Some(ref like) = keyword_like {
        for _ in 0..6 {
            param_refs.push(like);
        }
    }

    for pattern in &tag_patterns {
        param_refs.push(pattern);
    }

    if let Some(ref edu) = education_val {
        param_refs.push(edu);
    }

    if let Some(ref min) = min_exp {
        param_refs.push(min);
    }

    if let Some(ref max) = max_exp {
        param_refs.push(max);
    }

    if let Some(ref src) = source_val {
        param_refs.push(src);
    }

    if let Some(ref s) = school_val {
        param_refs.push(s);
    }

    if let Some(ref c) = city_val {
        param_refs.push(c);
    }

    if let Some(ref g) = gender_val {
        param_refs.push(g);
    }

    param_refs.push(&size);
    param_refs.push(&offset);

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        let msg = format!("Failed to prepare list_candidates query: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let candidates = stmt
        .query_map(param_refs.as_slice(), map_candidate)
        .map_err(|e| {
            let msg = format!("Failed to execute list_candidates query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(PaginatedCandidates {
        items: candidates,
        total,
        page: current_page,
        page_size: size,
        total_pages,
    })
}

/// Queries a single candidate by its ID.
#[tauri::command]
pub fn get_candidate(state: tauri::State<DbPool>, id: String) -> Result<Candidate, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let sql = format!(
        "SELECT {} FROM candidates c WHERE c.id = ?1 AND c.deleted_at IS NULL",
        CANDIDATE_COLUMNS
    );

    let candidate = conn
        .query_row(&sql, params![&id], map_candidate)
        .map_err(|e| {
            let msg = format!("Failed to get candidate {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(candidate)
}

/// Creates a new candidate after validating input.
#[tauri::command]
pub fn create_candidate(
    state: tauri::State<DbPool>,
    input: CreateCandidateInput,
) -> Result<Candidate, String> {
    validate_input(&input)?;

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let id = nanoid::nanoid!();
    let now = Local::now().to_rfc3339();
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".to_string());
    let work_json = input.work_experiences.unwrap_or_else(|| "[]".to_string());
    let edu_json = input.education_history.unwrap_or_else(|| "[]".to_string());

    conn.execute(
        "INSERT INTO candidates (id, name, phone, email, current_company, current_position, education, years_exp, source, tags, created_at, updated_at, gender, birth_date, expected_city, expected_salary, graduation_date, school, major, is_starred, is_hidden, work_experiences, education_history, source_detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, 0, 0, ?20, ?21, ?22)",
        params![
            &id,
            &input.name,
            &input.phone,
            &input.email,
            &input.current_company,
            &input.current_position,
            &input.education,
            &input.years_exp,
            &input.source,
            &tags_json,
            &now,
            &now,
            &input.gender,
            &input.birth_date,
            &input.expected_city,
            &input.expected_salary,
            &input.graduation_date,
            &input.school,
            &input.major,
            &work_json,
            &edu_json,
            &input.source_detail,
        ],
    )
    .map_err(|e| {
        let msg = format!("Failed to create candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Created candidate '{}' with id {}", input.name, id);

    // Auto-add to talent pool if requested (for resume imports)
    let in_talent_pool = if input.auto_pool.unwrap_or(false) {
        let pipeline_id = nanoid::nanoid!();
        conn.execute(
            "INSERT INTO candidate_pipeline (id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at) VALUES (?1, ?2, NULL, NULL, 'pooled', ?3, ?3)",
            params![&pipeline_id, &id, &now],
        ).map_err(|e| {
            let msg = format!("Failed to add candidate to talent pool: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        log::info!("Auto-added candidate '{}' to talent pool", input.name);
        true
    } else {
        false
    };

    Ok(Candidate {
        id,
        name: input.name,
        phone: input.phone,
        email: input.email,
        current_company: input.current_company,
        current_position: input.current_position,
        education: input.education,
        years_exp: input.years_exp,
        source: input.source,
        tags: input.tags,
        in_talent_pool,
        deleted_at: None,
        created_at: now.clone(),
        updated_at: now,
        gender: input.gender,
        birth_date: input.birth_date,
        expected_city: input.expected_city,
        expected_salary: input.expected_salary,
        graduation_date: input.graduation_date,
        school: input.school,
        major: input.major,
        is_starred: false,
        is_hidden: false,
        work_experiences: work_json,
        education_history: edu_json,
        source_detail: input.source_detail,
        avatar_url: None,
        age: None,
        last_active_at: None,
    })
}

/// Updates an existing candidate, only touching provided fields.
#[tauri::command]
pub fn update_candidate(
    state: tauri::State<DbPool>,
    id: String,
    input: UpdateCandidateInput,
) -> Result<Candidate, String> {
    validate_input(&input)?;

    // years_exp is Option<Option<i32>>; validate its range manually here.
    if let Some(Some(exp)) = input.years_exp {
        if exp < 0 || exp > 50 {
            return Err("工作年限应在 0-50 之间".to_string());
        }
    }

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut updates: Vec<String> = Vec::new();
    if input.name.is_some() {
        updates.push("name = ?".to_string());
    }
    if input.phone.is_some() {
        updates.push("phone = ?".to_string());
    }
    if input.email.is_some() {
        updates.push("email = ?".to_string());
    }
    if input.current_company.is_some() {
        updates.push("current_company = ?".to_string());
    }
    if input.current_position.is_some() {
        updates.push("current_position = ?".to_string());
    }
    if input.education.is_some() {
        updates.push("education = ?".to_string());
    }
    if input.years_exp.is_some() {
        updates.push("years_exp = ?".to_string());
    }
    if input.source.is_some() {
        updates.push("source = ?".to_string());
    }
    if input.tags.is_some() {
        updates.push("tags = ?".to_string());
    }
    // V8 fields
    if input.gender.is_some() {
        updates.push("gender = ?".to_string());
    }
    if input.birth_date.is_some() {
        updates.push("birth_date = ?".to_string());
    }
    if input.expected_city.is_some() {
        updates.push("expected_city = ?".to_string());
    }
    if input.expected_salary.is_some() {
        updates.push("expected_salary = ?".to_string());
    }
    if input.graduation_date.is_some() {
        updates.push("graduation_date = ?".to_string());
    }
    if input.school.is_some() {
        updates.push("school = ?".to_string());
    }
    if input.major.is_some() {
        updates.push("major = ?".to_string());
    }
    if input.source_detail.is_some() {
        updates.push("source_detail = ?".to_string());
    }
    if input.work_experiences.is_some() {
        updates.push("work_experiences = ?".to_string());
    }
    if input.education_history.is_some() {
        updates.push("education_history = ?".to_string());
    }
    if input.is_starred.is_some() {
        updates.push("is_starred = ?".to_string());
    }
    if input.is_hidden.is_some() {
        updates.push("is_hidden = ?".to_string());
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    updates.push("updated_at = ?".to_string());
    let sql = format!(
        "UPDATE candidates SET {} WHERE id = ? AND deleted_at IS NULL",
        updates.join(", ")
    );

    let now = Local::now().to_rfc3339();

    let mut param_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(ref v) = input.name {
        param_refs.push(v);
    }
    if let Some(ref v) = input.phone {
        param_refs.push(v);
    }
    if let Some(ref v) = input.email {
        param_refs.push(v);
    }
    if let Some(ref v) = input.current_company {
        param_refs.push(v);
    }
    if let Some(ref v) = input.current_position {
        param_refs.push(v);
    }
    if let Some(ref v) = input.education {
        param_refs.push(v);
    }
    if let Some(ref v) = input.years_exp {
        param_refs.push(v);
    }
    if let Some(ref v) = input.source {
        param_refs.push(v);
    }
    let tags_json;
    if let Some(ref v) = input.tags {
        tags_json = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        param_refs.push(&tags_json);
    }
    // V8 fields
    if let Some(ref v) = input.gender {
        param_refs.push(v);
    }
    if let Some(ref v) = input.birth_date {
        param_refs.push(v);
    }
    if let Some(ref v) = input.expected_city {
        param_refs.push(v);
    }
    if let Some(ref v) = input.expected_salary {
        param_refs.push(v);
    }
    if let Some(ref v) = input.graduation_date {
        param_refs.push(v);
    }
    if let Some(ref v) = input.school {
        param_refs.push(v);
    }
    if let Some(ref v) = input.major {
        param_refs.push(v);
    }
    if let Some(ref v) = input.source_detail {
        param_refs.push(v);
    }
    if let Some(ref v) = input.work_experiences {
        param_refs.push(v);
    }
    if let Some(ref v) = input.education_history {
        param_refs.push(v);
    }
    let starred_val;
    if let Some(ref v) = input.is_starred {
        starred_val = if *v { 1i32 } else { 0i32 };
        param_refs.push(&starred_val);
    }
    let hidden_val;
    if let Some(ref v) = input.is_hidden {
        hidden_val = if *v { 1i32 } else { 0i32 };
        param_refs.push(&hidden_val);
    }
    param_refs.push(&now);
    param_refs.push(&id);

    conn.execute(&sql, param_refs.as_slice()).map_err(|e| {
        let msg = format!("Failed to update candidate: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let query_sql = format!(
        "SELECT {} FROM candidates c WHERE c.id = ?1 AND c.deleted_at IS NULL",
        CANDIDATE_COLUMNS
    );

    let candidate = conn
        .query_row(&query_sql, params![&id], map_candidate)
        .map_err(|e| {
            let msg = format!("Failed to fetch updated candidate: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Updated candidate '{}' (id {})", candidate.name, candidate.id);
    Ok(candidate)
}

/// Soft-deletes a candidate and records an audit log entry.
#[tauri::command]
pub fn delete_candidate(state: tauri::State<DbPool>, id: String) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let query_sql = format!(
        "SELECT {} FROM candidates c WHERE c.id = ?1 AND c.deleted_at IS NULL",
        CANDIDATE_COLUMNS
    );

    let candidate = conn
        .query_row(&query_sql, params![&id], map_candidate)
        .map_err(|e| {
            let msg = format!("Failed to fetch candidate for deletion {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    let old_data = serde_json::to_string(&candidate).unwrap_or_else(|_| "{}".to_string());
    let now = Local::now().to_rfc3339();
    let audit_id = nanoid::nanoid!();

    // Wrap the audit-log write and the soft-delete in one transaction so they
    // either both commit or both roll back (previously they were not atomic).
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        conn.execute(
            "INSERT INTO audit_logs (id, table_name, record_id, action, old_data, performed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&audit_id, "candidates", &id, "soft_delete", &old_data, &now],
        )
        .map_err(|e| format!("Failed to write audit log for candidate deletion {}: {}", id, e))?;

        conn.execute(
            "UPDATE candidates SET deleted_at = ?1 WHERE id = ?2",
            params![&now, &id],
        )
        .map_err(|e| format!("Failed to soft-delete candidate {}: {}", id, e))?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            log::info!("Soft-deleted candidate '{}' (id {})", candidate.name, id);
            Ok(())
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            log::error!("Failed to soft-delete candidate (id {}): {}", id, e);
            Err(e)
        }
    }
}

/// Lists soft-deleted candidates for recycle bin.
#[tauri::command]
pub fn list_deleted_candidates(
    state: tauri::State<DbPool>,
) -> Result<Vec<Candidate>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM candidates c WHERE c.deleted_at IS NOT NULL ORDER BY c.deleted_at DESC",
            CANDIDATE_COLUMNS
        ))
        .map_err(|e| {
            let msg = format!("Failed to prepare list_deleted_candidates query: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    let candidates = stmt
        .query_map([], map_candidate)
        .map_err(|e| {
            let msg = format!("Failed to execute list_deleted_candidates query: {}", e);
            log::error!("{}", msg);
            msg
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            let msg = format!("Failed to collect deleted candidates: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    Ok(candidates)
}

/// Restores a soft-deleted candidate from recycle bin.
#[tauri::command]
pub fn restore_candidate(
    state: tauri::State<DbPool>,
    id: String,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let rows = conn
        .execute(
            "UPDATE candidates SET deleted_at = NULL WHERE id = ?1 AND deleted_at IS NOT NULL",
            params![&id],
        )
        .map_err(|e| {
            let msg = format!("Failed to restore candidate {}: {}", id, e);
            log::error!("{}", msg);
            msg
        })?;

    if rows == 0 {
        return Err("该候选人不在回收站中".to_string());
    }

    log::info!("Restored candidate (id {}) from recycle bin", id);
    Ok(())
}

/// Permanently deletes a candidate and all related data.
#[tauri::command]
pub fn permanently_delete_candidate(
    state: tauri::State<DbPool>,
    id: String,
) -> Result<(), String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Verify candidate is in recycle bin
    let deleted: Option<String> = conn
        .query_row(
            "SELECT id FROM candidates WHERE id = ?1 AND deleted_at IS NOT NULL",
            params![&id],
            |row| row.get(0),
        )
        .ok();

    if deleted.is_none() {
        return Err("该候选人不在回收站中，无法永久删除".to_string());
    }

    // Hard delete all related data in a transaction
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        conn.execute("DELETE FROM candidate_pipeline WHERE candidate_id = ?1", params![&id])
            .map_err(|e| format!("Failed to delete pipeline entries: {}", e))?;
        conn.execute("DELETE FROM follow_ups WHERE candidate_id = ?1", params![&id])
            .map_err(|e| format!("Failed to delete follow-ups: {}", e))?;
        conn.execute("DELETE FROM candidate_relations WHERE candidate_id_a = ?1 OR candidate_id_b = ?1", params![&id])
            .map_err(|e| format!("Failed to delete relations: {}", e))?;
        conn.execute("DELETE FROM resumes WHERE candidate_id = ?1", params![&id])
            .map_err(|e| format!("Failed to delete resumes: {}", e))?;
        conn.execute("DELETE FROM portfolios WHERE candidate_id = ?1", params![&id])
            .map_err(|e| format!("Failed to delete portfolios: {}", e))?;
        conn.execute("DELETE FROM pipeline_audit_log WHERE candidate_id = ?1", params![&id])
            .map_err(|e| format!("Failed to delete pipeline audit log: {}", e))?;
        conn.execute("DELETE FROM candidates WHERE id = ?1", params![&id])
            .map_err(|e| format!("Failed to delete candidate: {}", e))?;
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            log::info!("Permanently deleted candidate (id {})", id);
            Ok(())
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            log::error!("Failed to permanently delete candidate (id {}): {}", id, e);
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE candidates (
                id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT,
                current_company TEXT, current_position TEXT, education TEXT,
                years_exp INTEGER, source TEXT, tags TEXT,
                deleted_at TEXT, created_at TEXT, updated_at TEXT,
                gender TEXT, birth_date TEXT, expected_city TEXT, expected_salary TEXT,
                graduation_date TEXT, school TEXT, major TEXT,
                is_starred INTEGER, is_hidden INTEGER,
                work_experiences TEXT, education_history TEXT, source_detail TEXT,
                avatar_url TEXT, age INTEGER, last_active_at TEXT
            );
            CREATE TABLE candidate_pipeline (
                id TEXT PRIMARY KEY, candidate_id TEXT, job_id TEXT,
                current_stage_id TEXT, status TEXT, entered_at TEXT, updated_at TEXT
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn map_candidate_reads_columns_by_name() {
        let conn = setup_db();
        conn.execute(
            "INSERT INTO candidates (id, name, phone, email, source, tags, created_at, updated_at, is_starred, is_hidden, work_experiences, education_history, years_exp)
             VALUES ('c1', '张三', '13800138000', 'z@example.com', 'manual', '[\"offer\"]', '2026-01-01', '2026-01-01', 1, 0, '[]', '[]', 5)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO candidate_pipeline (id, candidate_id, job_id, current_stage_id, status, entered_at, updated_at)
             VALUES ('p1', 'c1', NULL, NULL, 'pooled', '2026-01-01', '2026-01-01')",
            [],
        )
        .unwrap();

        let sql = format!("SELECT {} FROM candidates c WHERE c.id = ?1", CANDIDATE_COLUMNS);
        let c = conn
            .query_row(&sql, rusqlite::params!["c1"], map_candidate)
            .unwrap();

        assert_eq!(c.id, "c1");
        assert_eq!(c.name, "张三");
        assert_eq!(c.phone.as_deref(), Some("13800138000"));
        assert_eq!(c.years_exp, Some(5));
        assert_eq!(c.tags, vec!["offer".to_string()]);
        assert!(c.is_starred);
        assert!(!c.is_hidden);
        assert!(c.in_talent_pool, "candidate with pooled pipeline should be in pool");
    }

    #[test]
    fn map_candidate_not_in_pool_when_no_pipeline() {
        let conn = setup_db();
        conn.execute(
            "INSERT INTO candidates (id, name, source, tags, created_at, updated_at, is_starred, is_hidden, work_experiences, education_history)
             VALUES ('c2', '李四', 'manual', '[]', '2026-01-01', '2026-01-01', 0, 0, '[]', '[]')",
            [],
        )
        .unwrap();

        let sql = format!("SELECT {} FROM candidates c WHERE c.id = ?1", CANDIDATE_COLUMNS);
        let c = conn
            .query_row(&sql, rusqlite::params!["c2"], map_candidate)
            .unwrap();

        assert_eq!(c.id, "c2");
        assert!(!c.in_talent_pool);
        assert!(!c.is_starred);
        assert!(c.tags.is_empty());
    }
}
