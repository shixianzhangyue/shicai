use crate::db::pool::DbPool;
use crate::services::baidu_ocr::OcrConfig;
use crate::services::llm_client::{LlmClient, LlmConfig, ParsedResume};
use crate::services::text_extractor::extract_text;
use crate::services::text_parser::parse_resume_text_regex;

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
fn get_default_ocr_config(conn: &rusqlite::Connection) -> Option<OcrConfig> {
    conn.query_row(
        "SELECT id, provider, api_key, secret_key, is_default, created_at, updated_at FROM ocr_configs WHERE is_default = 1 LIMIT 1",
        [],
        |row| {
            Ok(OcrConfig {
                id: row.get(0)?,
                provider: row.get(1)?,
                api_key: row.get(2)?,
                secret_key: row.get(3)?,
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
#[tauri::command(rename_all = "snake_case")]
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
#[tauri::command(rename_all = "snake_case")]
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
#[tauri::command(rename_all = "snake_case")]
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
