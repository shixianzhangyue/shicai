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
}

/// Extracts plain text from a resume file based on its extension.
///
/// Supports `.pdf`, `.docx`, and `.txt` formats.
pub fn extract_text(file_path: &str) -> Result<String, ExtractError> {
    let path = Path::new(file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "pdf" => extract_pdf(file_path),
        "docx" => extract_docx(file_path),
        "txt" => extract_txt(file_path),
        _ => Err(ExtractError::UnsupportedFormat),
    }
}

fn extract_pdf(file_path: &str) -> Result<String, ExtractError> {
    let text = pdf_extract::extract_text(file_path)
        .map_err(|e| ExtractError::PdfError(e.to_string()))?;

    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(ExtractError::ImagePdfNotSupported);
    }

    Ok(text)
}

fn extract_docx(file_path: &str) -> Result<String, ExtractError> {
    let doc = docx_rs::read_docx_from_file(file_path)
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
