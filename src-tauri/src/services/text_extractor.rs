use crate::services::baidu_ocr::OcrConfig;
use std::fs;
use std::path::Path;
use thiserror::Error;

/// Errors that can occur during text extraction from resume files.
#[derive(Debug, Error)]
pub enum ExtractError {
    #[error("不支持的文件格式")]
    UnsupportedFormat,
    #[error("该 PDF 为图片型简历，暂不支持解析")]
    ImagePdfNotSupported,
    #[error("文件读取失败: {0}")]
    IoError(#[from] std::io::Error),
    #[error("PDF 解析失败: {0}")]
    PdfError(String),
    #[error("DOCX 解析失败: {0}")]
    DocxError(String),
    #[error("OCR 识别失败: {0}")]
    OcrError(String),
}

/// Extracts plain text from a resume file based on its extension.
///
/// Supports `.pdf`, `.docx`, `.txt`, and image formats (`.jpg`, `.jpeg`, `.png`, `.bmp`).
/// Image formats and image-based PDFs require OCR configuration.
pub async fn extract_text(file_path: &str, ocr_config: Option<&OcrConfig>) -> Result<String, ExtractError> {
    let path = Path::new(file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "pdf" => extract_pdf(file_path, ocr_config).await,
        "docx" => extract_docx(file_path),
        "txt" => extract_txt(file_path),
        "jpg" | "jpeg" | "png" | "bmp" => extract_image(file_path, ocr_config).await,
        _ => Err(ExtractError::UnsupportedFormat),
    }
}

async fn extract_pdf(file_path: &str, ocr_config: Option<&OcrConfig>) -> Result<String, ExtractError> {
    let text = pdf_extract::extract_text(file_path)
        .map_err(|e| ExtractError::PdfError(e.to_string()))?;

    let trimmed = text.trim();
    if !trimmed.is_empty() {
        return Ok(text);
    }

    // Text is empty, try OCR fallback if config is provided
    if let Some(config) = ocr_config {
        return extract_image(file_path, Some(config)).await;
    }

    Err(ExtractError::ImagePdfNotSupported)
}

fn extract_docx(file_path: &str) -> Result<String, ExtractError> {
    let bytes = std::fs::read(file_path)
        .map_err(|e| ExtractError::DocxError(format!("Failed to read file: {:?}", e)))?;
    let doc = docx_rs::read_docx(&bytes)
        .map_err(|e| ExtractError::DocxError(format!("{:?}", e)))?;

    let mut paragraphs: Vec<String> = Vec::new();
    for child in &doc.document.children {
        if let docx_rs::DocumentChild::Paragraph(p) = child {
            let mut line = String::new();
            for run in &p.children {
                if let docx_rs::ParagraphChild::Run(r) = run {
                    for run_child in &r.children {
                        if let docx_rs::RunChild::Text(t) = run_child {
                            line.push_str(&t.text);
                        }
                    }
                }
            }
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                paragraphs.push(trimmed.to_string());
            }
        }
    }

    Ok(paragraphs.join("\n"))
}

fn extract_txt(file_path: &str) -> Result<String, ExtractError> {
    let text = fs::read_to_string(file_path)?;
    Ok(text)
}

/// Extracts text from an image file using OCR.
/// Returns an error if OCR config is not provided.
async fn extract_image(file_path: &str, ocr_config: Option<&OcrConfig>) -> Result<String, ExtractError> {
    let config = ocr_config.ok_or(ExtractError::ImagePdfNotSupported)?;

    // Read image file and convert to base64
    let bytes = fs::read(file_path)?;
    let base64_image = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);

    // Directly await the async OCR call — caller is already in an async context
    let result = crate::services::baidu_ocr::BaiduOcrClient::recognize_image(
        &config.api_key,
        &config.secret_key,
        &base64_image,
    )
    .await
    .map_err(|e| ExtractError::OcrError(e.to_string()))?;

    if result.text.trim().is_empty() {
        return Err(ExtractError::OcrError("OCR 未识别到任何文字".to_string()));
    }

    Ok(result.text)
}
