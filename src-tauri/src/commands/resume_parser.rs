use crate::db::pool::DbPool;
use crate::services::baidu_ocr::OcrConfig;
use crate::services::llm_client::{LlmClient, LlmConfig, ParsedResume};
use crate::services::text_extractor::extract_text;

/// Parses a resume file and returns structured candidate data.
#[tauri::command]
pub async fn parse_resume(
    state: tauri::State<'_, DbPool>,
    file_path: String,
) -> Result<ParsedResume, String> {
    // Retrieve the default LLM configuration.
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let config: LlmConfig = conn
        .query_row(
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
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "请先配置 LLM".to_string(),
            _ => format!("数据库错误: {}", e),
        })?;

    // Query default OCR configuration (optional, for image-based resumes).
    let ocr_config: Option<OcrConfig> = conn
        .query_row(
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
        .ok(); // No OCR config is fine — image-based resumes will return an error.

    // Extract text from the resume file (with optional OCR fallback).
    let text = extract_text(&file_path, ocr_config.as_ref()).await.map_err(|e| e.to_string())?;

    // Send to LLM for parsing.
    let mut parsed = LlmClient::parse_resume(&config, &text)
        .await
        .map_err(|e| e.to_string())?;

    // Ensure raw_text_preview is populated.
    if parsed.raw_text_preview.is_empty() {
        parsed.raw_text_preview = text.chars().take(1000).collect::<String>();
    }

    Ok(parsed)
}

/// Parses resume text directly and returns structured candidate data.
#[tauri::command]
pub async fn parse_resume_text(
    state: tauri::State<'_, DbPool>,
    text: String,
) -> Result<ParsedResume, String> {
    if text.trim().is_empty() {
        return Err("简历文本不能为空".to_string());
    }

    // Retrieve the default LLM configuration.
    let conn = state.get().map_err(|e| {
        let msg = format!("Failed to get database connection: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let config: LlmConfig = conn
        .query_row(
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
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "请先配置 LLM".to_string(),
            _ => format!("数据库错误: {}", e),
        })?;

    // Send to LLM for parsing.
    let mut parsed = LlmClient::parse_resume(&config, &text)
        .await
        .map_err(|e| e.to_string())?;

    // Ensure raw_text_preview is populated.
    if parsed.raw_text_preview.is_empty() {
        parsed.raw_text_preview = text.chars().take(1000).collect::<String>();
    }

    Ok(parsed)
}
