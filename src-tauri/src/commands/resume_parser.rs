use crate::db::pool::DbPool;
use crate::services::baidu_ocr::OcrConfig;
use crate::services::llm_client::{LlmClient, LlmConfig, ParsedResume};
use crate::services::text_extractor::extract_text;
use crate::services::text_parser::parse_resume_text_regex;
use chrono::Local;
use rusqlite::params;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Helper: query the default LLM config from the database.
/// Returns `None` if no LLM is configured (not an error — OCR-only mode is supported).
fn get_default_llm_config(conn: &rusqlite::Connection) -> Result<Option<LlmConfig>, String> {
    match conn.query_row(
        "SELECT id, provider, api_key, base_url, model_name, is_default, created_at, updated_at FROM llm_configs WHERE is_default = 1 LIMIT 1",
        [],
        |row| {
            Ok(LlmConfig {
                id: row.get(0)?,
                provider: row.get(1)?,
                api_key: row.get(2)?,
                base_url: row.get(3)?,
                model_name: row.get(4)?,
                is_default: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    ) {
        Ok(config) => Ok(Some(config)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("数据库错误: {}", e)),
    }
}

/// Helper: query the default OCR config from the database.
/// SECURITY: Decrypts credentials for internal use.
fn get_default_ocr_config(conn: &rusqlite::Connection) -> Option<OcrConfig> {
    use crate::services::llm_client::deobfuscate_key;

    conn.query_row(
        "SELECT id, provider, api_key, secret_key, is_default, created_at, updated_at FROM ocr_configs WHERE is_default = 1 LIMIT 1",
        [],
        |row| {
            let encrypted_api: String = row.get(2)?;
            let encrypted_secret: String = row.get(3)?;
            Ok(OcrConfig {
                id: row.get(0)?,
                provider: row.get(1)?,
                api_key: deobfuscate_key(&encrypted_api),
                secret_key: deobfuscate_key(&encrypted_secret),
                is_default: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .ok()
}

/// Build a ParsedResume when LLM is not configured.
/// Used for OCR-only / text-only mode — uses regex patterns to extract structured fields.
fn build_raw_parsed_resume(raw_text: String, parse_source: &str) -> ParsedResume {
    log::info!("Using regex-based text parser for OCR-only mode");
    let mut parsed = parse_resume_text_regex(&raw_text);
    // Override parse_source to match the caller's source
    parsed.parse_source = parse_source.to_string();
    parsed
}

/// Parses a resume file and returns structured candidate data.
/// Supports two modes:
/// - **LLM mode** (default): OCR/extract text → LLM structured parsing
/// - **OCR-only mode**: OCR/extract text → return raw text with empty fields (user fills manually)
#[tauri::command]
pub async fn parse_resume(
    state: tauri::State<'_, DbPool>,
    file_path: String,
) -> Result<ParsedResume, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let llm_config = get_default_llm_config(&conn)?;
    let ocr_config = get_default_ocr_config(&conn);

    // Extract text from the resume file (with optional OCR fallback).
    let text = extract_text(&file_path, ocr_config.as_ref()).await.map_err(|e| e.to_string())?;

    // If LLM is configured, use it for structured parsing.
    if let Some(config) = llm_config {
        let mut parsed = LlmClient::parse_resume(&config, &text)
            .await
            .map_err(|e| e.to_string())?;

        // Ensure raw_text_preview and raw_text_full are populated.
        if parsed.raw_text_preview.is_empty() {
            parsed.raw_text_preview = text.chars().take(1000).collect::<String>();
        }
        if parsed.raw_text_full.is_empty() {
            parsed.raw_text_full = text;
        }

        Ok(parsed)
    } else {
        // No LLM configured — return raw text only (OCR-only mode).
        log::info!("No LLM configured, returning raw text (OCR-only mode)");
        Ok(build_raw_parsed_resume(text, "ocr"))
    }
}

/// Parses resume text directly and returns structured candidate data.
/// Supports OCR-only mode when no LLM is configured.
#[tauri::command]
pub async fn parse_resume_text(
    state: tauri::State<'_, DbPool>,
    text: String,
) -> Result<ParsedResume, String> {
    if text.trim().is_empty() {
        return Err("简历文本不能为空".to_string());
    }

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let llm_config = get_default_llm_config(&conn)?;

    // If LLM is configured, use it for structured parsing.
    if let Some(config) = llm_config {
        let mut parsed = LlmClient::parse_resume(&config, &text)
            .await
            .map_err(|e| e.to_string())?;

        // Ensure raw_text_preview and raw_text_full are populated.
        if parsed.raw_text_preview.is_empty() {
            parsed.raw_text_preview = text.chars().take(1000).collect::<String>();
        }
        if parsed.raw_text_full.is_empty() {
            parsed.raw_text_full = text;
        }

        Ok(parsed)
    } else {
        // No LLM configured — return raw text only.
        log::info!("No LLM configured, returning raw text (text-only mode)");
        Ok(build_raw_parsed_resume(text, "text"))
    }
}

/// Layer 2: Re-parses only the fields marked as inaccurate by the user.
/// **Requires LLM** — AI enhancement is not available in OCR-only mode.
#[tauri::command]
pub async fn parse_resume_enhance(
    state: tauri::State<'_, DbPool>,
    raw_text_full: String,
    current_data: ParsedResume,
    fields_to_enhance: Vec<String>,
) -> Result<ParsedResume, String> {
    if raw_text_full.trim().is_empty() {
        return Err("原始简历文本不能为空".to_string());
    }
    if fields_to_enhance.is_empty() {
        return Err("未选择需要重新识别的字段".to_string());
    }

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // AI enhancement requires LLM — return clear error if not configured.
    let config = get_default_llm_config(&conn)?
        .ok_or("AI 增强需要配置 LLM，请先在设置中配置大模型 API")?;

    let merged = LlmClient::enhance_resume(
        &config,
        &raw_text_full,
        &current_data,
        &fields_to_enhance,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(merged)
}

/// Resume record returned after saving.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeRecord {
    pub id: String,
    pub candidate_id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub parsed_data: Option<String>,
    pub uploaded_at: String,
    // V10 enhanced fields
    pub resume_type: Option<String>,
    pub version: Option<i32>,
    pub is_current: Option<bool>,
    pub parsed_by: Option<String>,
    pub parsed_at: Option<String>,
    pub raw_text: Option<String>,
    pub parsed_json: Option<String>,
}

/// Saves the original resume file to app data directory and creates a resume record.
/// This is called after a candidate is created from a parsed resume, so the original
/// file is preserved alongside the structured candidate data.
#[tauri::command]
pub fn save_resume(
    app: tauri::AppHandle,
    state: tauri::State<'_, DbPool>,
    candidate_id: String,
    file_path: String,
    parsed_data: Option<ParsedResume>,
) -> Result<ResumeRecord, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Resolve the original file path
    let src = Path::new(&file_path);
    if !src.exists() {
        return Err(format!("原简历文件不存在: {}", file_path));
    }

    // Get app data dir for storing the resume
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create resumes directory for this candidate: resumes/{candidate_id}/
    let resume_dir = app_data_dir.join("resumes").join(&candidate_id);
    std::fs::create_dir_all(&resume_dir)
        .map_err(|e| format!("Failed to create resume directory: {}", e))?;

    // Build destination filename: {timestamp}_{original_filename}
    let original_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("resume");
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let dest_filename = format!("{}_{}", timestamp, original_name);
    let dest_path = resume_dir.join(&dest_filename);

    // Copy the original file
    std::fs::copy(src, &dest_path)
        .map_err(|e| format!("Failed to copy resume file: {}", e))?;

    // Extract file type from extension
    let file_type = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_lowercase();

    // Determine the stored file path (relative to app data dir for portability)
    let stored_path = dest_path
        .to_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| dest_filename.clone());

    // Serialize parsed data if available
    let parsed_json = parsed_data
        .as_ref()
        .and_then(|pd| serde_json::to_string(pd).ok());

    let now = Local::now().to_rfc3339();
    let resume_id = nanoid::nanoid!();

    // Insert into resumes table
    conn.execute(
        "INSERT INTO resumes (id, candidate_id, file_path, file_name, file_type, parsed_data, uploaded_at, resume_type, version, is_current, parsed_by, parsed_at, raw_text, parsed_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            &resume_id,
            &candidate_id,
            &stored_path,
            &original_name,
            &file_type,
            &parsed_json,    // parsed_data column (V1 original)
            &now,
            "original",      // resume_type: the original uploaded file
            1,               // version: first version
            1,               // is_current: this is the current version
            &parsed_data.as_ref().map(|p| p.parse_source.clone()).unwrap_or_default(), // parsed_by
            &now,            // parsed_at
            &parsed_data.as_ref().map(|p| p.raw_text_full.clone()).unwrap_or_default(), // raw_text
            &parsed_json,    // parsed_json (V10 enhanced field)
        ],
    )
    .map_err(|e| {
        let msg = format!("Failed to save resume record: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!(
        "Saved resume '{}' for candidate {} (id {})",
        original_name,
        candidate_id,
        resume_id
    );

    Ok(ResumeRecord {
        id: resume_id,
        candidate_id,
        file_path: stored_path,
        file_name: original_name.to_string(),
        file_type,
        parsed_data: parsed_json.clone(),
        uploaded_at: now.clone(),
        resume_type: Some("original".to_string()),
        version: Some(1),
        is_current: Some(true),
        parsed_by: parsed_data.as_ref().map(|p| p.parse_source.clone()),
        parsed_at: Some(now),
        raw_text: parsed_data.as_ref().map(|p| p.raw_text_full.clone()),
        parsed_json,
    })
}

/// Lists all resume records for a candidate.
#[tauri::command]
pub fn list_resumes(
    state: tauri::State<'_, DbPool>,
    candidate_id: String,
) -> Result<Vec<ResumeRecord>, String> {
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, candidate_id, file_path, file_name, file_type, parsed_data, uploaded_at, resume_type, version, is_current, parsed_by, parsed_at, raw_text, parsed_json FROM resumes WHERE candidate_id = ?1 ORDER BY uploaded_at DESC",
        )
        .map_err(|e| format!("Failed to prepare list_resumes query: {}", e))?;

    let records = stmt
        .query_map(params![&candidate_id], |row| {
            let is_current_raw: i32 = row.get(9)?;
            Ok(ResumeRecord {
                id: row.get(0)?,
                candidate_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_type: row.get(4)?,
                parsed_data: row.get(5)?,
                uploaded_at: row.get(6)?,
                resume_type: row.get(7)?,
                version: row.get(8)?,
                is_current: Some(is_current_raw != 0),
                parsed_by: row.get(10)?,
                parsed_at: row.get(11)?,
                raw_text: row.get(12)?,
                parsed_json: row.get(13)?,
            })
        })
        .map_err(|e| format!("Failed to execute list_resumes query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect resumes: {}", e))?;

    Ok(records)
}

// ─── Batch & Image Parse (V13) ─────────────────────────────────

/// Result of parsing a single file in a batch operation.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchParseItem {
    pub file_path: String,
    pub file_name: String,
    pub success: bool,
    pub data: Option<ParsedResume>,
    pub error: Option<String>,
}

/// Batch-parse multiple resume files concurrently.
/// Each file goes through the full extract-text → LLM/OCR pipeline.
/// Returns results in the same order as input paths.
#[tauri::command]
pub async fn batch_parse_resumes(
    state: tauri::State<'_, DbPool>,
    file_paths: Vec<String>,
) -> Result<Vec<BatchParseItem>, String> {
    if file_paths.is_empty() {
        return Err("未选择任何文件".to_string());
    }

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let llm_config = get_default_llm_config(&conn)?;
    let ocr_config = get_default_ocr_config(&conn);

    // Process files with bounded concurrency using JoinSet
    const MAX_CONCURRENT: usize = 3;
    use tokio::task::JoinSet;

    let mut set = JoinSet::new();
    let mut results: Vec<(usize, BatchParseItem)> = Vec::with_capacity(file_paths.len());

    for (idx, file_path) in file_paths.into_iter().enumerate() {
        let llm_cfg = llm_config.clone();
        let ocr_cfg = ocr_config.clone();

        // Spawn task
        set.spawn(async move {
            let path_buf = PathBuf::from(&file_path);
            let file_name = path_buf
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            match extract_text(&file_path, ocr_cfg.as_ref()).await {
                Ok(text) => {
                    if let Some(ref config) = llm_cfg {
                        match LlmClient::parse_resume(config, &text).await {
                            Ok(mut parsed) => {
                                if parsed.raw_text_preview.is_empty() {
                                    parsed.raw_text_preview =
                                        text.chars().take(1000).collect();
                                }
                                if parsed.raw_text_full.is_empty() {
                                    parsed.raw_text_full = text;
                                }
                                (idx, BatchParseItem {
                                    file_path,
                                    file_name,
                                    success: true,
                                    data: Some(parsed),
                                    error: None,
                                })
                            }
                            Err(e) => (idx, BatchParseItem {
                                file_path,
                                file_name,
                                success: false,
                                data: None,
                                error: Some(format!("AI 解析失败: {}", e)),
                            }),
                        }
                    } else {
                        let parsed = build_raw_parsed_resume(text, "ocr");
                        (idx, BatchParseItem {
                            file_path,
                            file_name,
                            success: true,
                            data: Some(parsed),
                            error: None,
                        })
                    }
                }
                Err(e) => (idx, BatchParseItem {
                    file_path,
                    file_name,
                    success: false,
                    data: None,
                    error: Some(format!("文本提取失败: {}", e)),
                }),
            }
        });

        // If we hit the concurrency limit, wait for one to finish before spawning more
        if set.len() >= MAX_CONCURRENT {
            if let Some(result) = set.join_next().await {
                if let Ok(item) = result {
                    results.push(item);
                }
            }
        }
    }

    // Drain remaining tasks
    while let Some(result) = set.join_next().await {
        if let Ok(item) = result {
            results.push(item);
        }
    }

    // Sort by original index to preserve input order
    results.sort_by_key(|(idx, _)| *idx);
    let final_results: Vec<BatchParseItem> = results.into_iter().map(|(_, item)| item).collect();

    Ok(final_results)
}

/// Parses a resume image from base64-encoded data (clipboard paste / screenshot).
/// Goes through OCR → LLM pipeline.
#[tauri::command]
pub async fn parse_resume_image_base64(
    state: tauri::State<'_, DbPool>,
    image_base64: String,
) -> Result<ParsedResume, String> {
    if image_base64.trim().is_empty() {
        return Err("图片数据不能为空".to_string());
    }

    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let ocr_config = get_default_ocr_config(&conn).ok_or(
        "剪贴板图片解析需要配置 OCR（百度OCR），请先在设置中配置".to_string(),
    )?;
    let llm_config = get_default_llm_config(&conn)?;

    // Step 1: OCR recognition on the base64 image
    log::info!("Starting OCR on pasted image ({} bytes)", image_base64.len());
    let ocr_result = crate::services::baidu_ocr::BaiduOcrClient::recognize_image(
        &ocr_config.api_key,
        &ocr_config.secret_key,
        &image_base64,
    )
    .await
    .map_err(|e| format!("OCR 识别失败: {}", e))?;

    if ocr_result.text.trim().is_empty() {
        return Err("OCR 未识别到任何文字，请确保截图清晰".to_string());
    }

    let text = ocr_result.text;
    log::info!("OCR extracted {} chars from pasted image", text.len());

    // Step 2: LLM structured parsing (if configured)
    if let Some(config) = llm_config {
        let mut parsed = LlmClient::parse_resume(&config, &text)
            .await
            .map_err(|e| e.to_string())?;

        if parsed.raw_text_preview.is_empty() {
            parsed.raw_text_preview = text.chars().take(1000).collect::<String>();
        }
        if parsed.raw_text_full.is_empty() {
            parsed.raw_text_full = text;
        }
        parsed.parse_source = "clipboard_ocr".to_string();
        Ok(parsed)
    } else {
        log::info!("No LLM configured, returning OCR-only result");
        let mut parsed = build_raw_parsed_resume(text, "clipboard_ocr");
        parsed.parse_source = "clipboard_ocr".to_string();
        Ok(parsed)
    }
}
