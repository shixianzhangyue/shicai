use serde::{Deserialize, Serialize};
use serde_json::json;
use std::str::FromStr;
use std::time::Duration;
use thiserror::Error;

use crate::services::prompt::{RESUME_PARSE_PROMPT, AI_ENHANCE_PROMPT};

const SALT: &[u8] = b"TalentVaultStep24";

/// Errors that can occur during LLM client operations.
#[derive(Debug, Error)]
pub enum LlmError {
    #[error("网络请求超时，请检查网络连接")]
    NetworkTimeout,
    #[error("API 错误: {0}")]
    ApiError(String),
    #[error("解析失败: {0}")]
    ParseError(String),
    #[error("未找到默认 LLM 配置")]
    NoConfig,
}

impl From<reqwest::Error> for LlmError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            LlmError::NetworkTimeout
        } else {
            LlmError::ApiError(err.to_string())
        }
    }
}

/// Supported LLM providers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Provider {
    #[serde(rename = "openai")]
    OpenAI,
    #[serde(rename = "baidu_ernie")]
    BaiduErnie,
    #[serde(rename = "qwen")]
    Qwen,
    #[serde(rename = "xunfei")]
    Xunfei,
    #[serde(rename = "custom")]
    Custom,
}

impl Provider {
    /// Returns the default base URL for this provider.
    pub fn default_base_url(&self) -> &'static str {
        match self {
            Provider::OpenAI => "https://api.openai.com/v1",
            Provider::BaiduErnie => "https://qianfan.baidubce.com/v2",
            Provider::Qwen => "https://dashscope.aliyuncs.com/compatible-mode/v1",
            Provider::Xunfei => "https://spark-api-open.xf-yun.com/v1",
            Provider::Custom => "",
        }
    }

    /// Returns the default model name for this provider.
    pub fn default_model(&self) -> &'static str {
        match self {
            Provider::OpenAI => "gpt-4o-mini",
            Provider::BaiduErnie => "ernie-speed-128k",
            Provider::Qwen => "qwen-turbo",
            Provider::Xunfei => "generalv3.5",
            Provider::Custom => "",
        }
    }
}

impl FromStr for Provider {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "openai" => Ok(Provider::OpenAI),
            "baidu_ernie" => Ok(Provider::BaiduErnie),
            "qwen" => Ok(Provider::Qwen),
            "xunfei" => Ok(Provider::Xunfei),
            "custom" => Ok(Provider::Custom),
            _ => Err(format!("Unknown provider: {}", s)),
        }
    }
}

/// Configuration for connecting to an LLM provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub id: i64,
    pub provider: String,
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating a new LLM configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLlmConfigInput {
    pub provider: String,
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
}

/// Input for updating an existing LLM configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLlmConfigInput {
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model_name: Option<String>,
    pub is_default: Option<bool>,
}

/// Parsed resume structure returned by the LLM.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedResume {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub gender: Option<String>,
    pub birth_date: Option<String>,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
    pub education: Option<String>,
    pub years_exp: Option<i32>,
    pub expected_salary: Option<String>,
    pub expected_city: Option<String>,
    pub self_introduction: Option<String>,
    pub skills: Vec<String>,
    pub work_experiences: Vec<WorkExperience>,
    pub project_experiences: Vec<ProjectExperience>,
    pub raw_text_preview: String,
    /// Full original text (not truncated) — used by Layer 2 AI enhancement.
    #[serde(skip_serializing_if = "String::is_empty", default)]
    pub raw_text_full: String,
    /// Data source: "ocr", "llm", or "ai_enhanced".
    #[serde(skip_serializing_if = "String::is_empty", default)]
    pub parse_source: String,
}

/// A single work experience entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkExperience {
    pub company: String,
    pub position: String,
    pub duration: String,
    pub description: Option<String>,
}

/// A single project experience entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectExperience {
    pub name: String,
    pub role: Option<String>,
    pub duration: Option<String>,
    pub description: Option<String>,
    pub technologies: Vec<String>,
}

/// Client for interacting with LLM APIs.
pub struct LlmClient;

impl LlmClient {
    /// Tests the LLM connection by sending a simple prompt.
    pub async fn test_connection(config: &LlmConfig) -> Result<String, LlmError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| LlmError::ApiError(e.to_string()))?;

        let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
        let api_key = deobfuscate_key(&config.api_key);

        let body = json!({
            "model": config.model_name,
            "messages": [
                { "role": "user", "content": "hi" }
            ],
            "max_tokens": 5
        });

        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        let status = resp.status();
        let text = resp.text().await?;

        if !status.is_success() {
            return Err(LlmError::ApiError(format!(
                "HTTP {}: {}",
                status.as_u16(),
                text.chars().take(200).collect::<String>()
            )));
        }

        Ok("连接成功".to_string())
    }

    /// Sends resume text to the LLM and returns structured parsed data.
    pub async fn parse_resume(config: &LlmConfig, text: &str) -> Result<ParsedResume, LlmError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| LlmError::ApiError(e.to_string()))?;

        let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
        let api_key = deobfuscate_key(&config.api_key);

    let body = json!({
            "model": config.model_name,
            "messages": [
                { "role": "system", "content": RESUME_PARSE_PROMPT },
                { "role": "user", "content": text }
            ],
            "temperature": 0.2,
        });

        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        let status = resp.status();
        let resp_text = resp.text().await?;

        if !status.is_success() {
            return Err(LlmError::ApiError(format!(
                "HTTP {}: {}",
                status.as_u16(),
                resp_text.chars().take(200).collect::<String>()
            )));
        }

        let parsed_resp: serde_json::Value = serde_json::from_str(&resp_text)
            .map_err(|e| LlmError::ParseError(format!("Invalid JSON response: {}", e)))?;

        let content = parsed_resp
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|msg| msg.get("content"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| LlmError::ParseError("Missing content in LLM response".to_string()))?;

        let clean_content = content
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let parsed: serde_json::Value = serde_json::from_str(clean_content)
            .map_err(|e| LlmError::ParseError(format!("Failed to parse LLM output as JSON: {}. Raw: {}", e, clean_content.chars().take(500).collect::<String>())))?;

        let raw_text_preview = text.chars().take(1000).collect::<String>();

        let resume = ParsedResume {
            name: parsed.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()),
            phone: parsed.get("phone").and_then(|v| v.as_str()).map(|s| s.to_string()),
            email: parsed.get("email").and_then(|v| v.as_str()).map(|s| s.to_string()),
            gender: parsed.get("gender").and_then(|v| v.as_str()).map(|s| s.to_string()),
            birth_date: parsed.get("birth_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
            current_company: parsed.get("current_company").and_then(|v| v.as_str()).map(|s| s.to_string()),
            current_position: parsed.get("current_position").and_then(|v| v.as_str()).map(|s| s.to_string()),
            education: parsed.get("education").and_then(|v| v.as_str()).map(|s| s.to_string()),
            years_exp: parsed.get("years_exp").and_then(|v| {
                if v.is_null() { return None; }
                v.as_i64().map(|n| n as i32).or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
            }),
            expected_salary: parsed.get("expected_salary").and_then(|v| v.as_str()).map(|s| s.to_string()),
            expected_city: parsed.get("expected_city").and_then(|v| v.as_str()).map(|s| s.to_string()),
            self_introduction: parsed.get("self_introduction").and_then(|v| v.as_str()).map(|s| s.to_string()),
            skills: parsed.get("skills")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
            work_experiences: parsed.get("work_experiences")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter().filter_map(|v| {
                        let company = v.get("company")?.as_str()?;
                        let position = v.get("position")?.as_str()?;
                        let duration = v.get("duration")?.as_str()?;
                        let description = v.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
                        Some(WorkExperience {
                            company: company.to_string(),
                            position: position.to_string(),
                            duration: duration.to_string(),
                            description,
                        })
                    }).collect()
                })
                .unwrap_or_default(),
            project_experiences: parsed.get("project_experiences")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter().filter_map(|v| {
                        let name = v.get("name")?.as_str()?;
                        let role = v.get("role").and_then(|r| r.as_str()).map(|s| s.to_string());
                        let duration = v.get("duration").and_then(|d| d.as_str()).map(|s| s.to_string());
                        let description = v.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
                        let technologies = v.get("technologies")
                            .and_then(|t| t.as_array())
                            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();
                        Some(ProjectExperience {
                            name: name.to_string(),
                            role,
                            duration,
                            description,
                            technologies,
                        })
                    }).collect()
                })
                .unwrap_or_default(),
            raw_text_preview,
            raw_text_full: text.to_string(),
            parse_source: "llm".to_string(),
        };

        Ok(resume)
    }

    /// Layer 2: Re-parses only the fields the user marked as inaccurate.
    /// Returns a full ParsedResume where only the enhanced fields are updated.
    pub async fn enhance_resume(
        config: &LlmConfig,
        text: &str,
        current_data: &ParsedResume,
        fields_to_enhance: &[String],
    ) -> Result<ParsedResume, LlmError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| LlmError::ApiError(e.to_string()))?;

        let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
        let api_key = deobfuscate_key(&config.api_key);

        // Build the system prompt: template + field names
        let fields_list = fields_to_enhance.join(", ");
        let current_data_json = serde_json::to_string_pretty(current_data)
            .unwrap_or_else(|_| "{}".to_string());
        let system_prompt = format!(
            "{}\n\n当前已解析数据：\n{}\n\n需要重新识别的字段：{}",
            AI_ENHANCE_PROMPT, current_data_json, fields_list
        );

        let body = json!({
            "model": config.model_name,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": text }
            ],
            "temperature": 0.2,
        });

        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        let status = resp.status();
        let resp_text = resp.text().await?;

        if !status.is_success() {
            return Err(LlmError::ApiError(format!(
                "HTTP {}: {}",
                status.as_u16(),
                resp_text.chars().take(200).collect::<String>()
            )));
        }

        let parsed_resp: serde_json::Value = serde_json::from_str(&resp_text)
            .map_err(|e| LlmError::ParseError(format!("Invalid JSON response: {}", e)))?;

        let content = parsed_resp
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|msg| msg.get("content"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| LlmError::ParseError("Missing content in LLM response".to_string()))?;

        let clean_content = content
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let partial: serde_json::Value = serde_json::from_str(clean_content)
            .map_err(|e| LlmError::ParseError(format!(
                "Failed to parse LLM enhance output as JSON: {}. Raw: {}",
                e,
                clean_content.chars().take(500).collect::<String>()
            )))?;

        // Merge: start from current_data, overwrite only the enhanced fields
        let mut merged = current_data.clone();

        if partial.get("name").is_some() {
            merged.name = partial.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("phone").is_some() {
            merged.phone = partial.get("phone").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("email").is_some() {
            merged.email = partial.get("email").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("gender").is_some() {
            merged.gender = partial.get("gender").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("birth_date").is_some() {
            merged.birth_date = partial.get("birth_date").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("current_company").is_some() {
            merged.current_company = partial.get("current_company").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("current_position").is_some() {
            merged.current_position = partial.get("current_position").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("education").is_some() {
            merged.education = partial.get("education").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("years_exp").is_some() {
            merged.years_exp = partial.get("years_exp").and_then(|v| {
                if v.is_null() { return None; }
                v.as_i64().map(|n| n as i32).or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
            });
        }
        if partial.get("expected_salary").is_some() {
            merged.expected_salary = partial.get("expected_salary").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("expected_city").is_some() {
            merged.expected_city = partial.get("expected_city").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("self_introduction").is_some() {
            merged.self_introduction = partial.get("self_introduction").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
        if partial.get("skills").is_some() {
            merged.skills = partial.get("skills")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
        }
        if partial.get("work_experiences").is_some() {
            merged.work_experiences = partial.get("work_experiences")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter().filter_map(|v| {
                        let company = v.get("company")?.as_str()?;
                        let position = v.get("position")?.as_str()?;
                        let duration = v.get("duration")?.as_str()?;
                        let description = v.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
                        Some(WorkExperience {
                            company: company.to_string(),
                            position: position.to_string(),
                            duration: duration.to_string(),
                            description,
                        })
                    }).collect()
                })
                .unwrap_or_default();
        }
        if partial.get("project_experiences").is_some() {
            merged.project_experiences = partial.get("project_experiences")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter().filter_map(|v| {
                        let name = v.get("name")?.as_str()?;
                        let role = v.get("role").and_then(|r| r.as_str()).map(|s| s.to_string());
                        let duration = v.get("duration").and_then(|d| d.as_str()).map(|s| s.to_string());
                        let description = v.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
                        let technologies = v.get("technologies")
                            .and_then(|t| t.as_array())
                            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();
                        Some(ProjectExperience {
                            name: name.to_string(),
                            role,
                            duration,
                            description,
                            technologies,
                        })
                    }).collect()
                })
                .unwrap_or_default();
        }

        merged.parse_source = "ai_enhanced".to_string();
        Ok(merged)
    }
}

/// Obfuscates an API key using XOR with a rotating salt.
pub fn obfuscate_key(key: &str) -> String {
    let bytes = key.as_bytes();
    let mut obfuscated = Vec::with_capacity(bytes.len());
    for (i, &b) in bytes.iter().enumerate() {
        obfuscated.push(b ^ SALT[i % SALT.len()]);
    }
    base64::encode(&obfuscated)
}

/// Deobfuscates an API key that was obfuscated with `obfuscate_key`.
pub fn deobfuscate_key(key: &str) -> String {
    let bytes = base64::decode(key).unwrap_or_default();
    let mut deobfuscated = Vec::with_capacity(bytes.len());
    for (i, &b) in bytes.iter().enumerate() {
        deobfuscated.push(b ^ SALT[i % SALT.len()]);
    }
    String::from_utf8(deobfuscated).unwrap_or_default()
}

// Simple base64 implementation to avoid extra dependency.
mod base64 {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    pub fn encode(input: &[u8]) -> String {
        let mut result = String::new();
        let mut i = 0;
        while i < input.len() {
            let b1 = input[i];
            let b2 = if i + 1 < input.len() { input[i + 1] } else { 0 };
            let b3 = if i + 2 < input.len() { input[i + 2] } else { 0 };

            let idx1 = (b1 >> 2) as usize;
            let idx2 = (((b1 & 0b11) << 4) | (b2 >> 4)) as usize;
            let idx3 = (((b2 & 0b1111) << 2) | (b3 >> 6)) as usize;
            let idx4 = (b3 & 0b111111) as usize;

            result.push(ALPHABET[idx1] as char);
            result.push(ALPHABET[idx2] as char);
            if i + 1 < input.len() {
                result.push(ALPHABET[idx3] as char);
            } else {
                result.push('=');
            }
            if i + 2 < input.len() {
                result.push(ALPHABET[idx4] as char);
            } else {
                result.push('=');
            }
            i += 3;
        }
        result
    }

    pub fn decode(input: &str) -> Result<Vec<u8>, String> {
        let mut result = Vec::new();
        let mut buffer = 0u32;
        let mut bits_collected = 0;

        for ch in input.chars() {
            if ch == '=' {
                break;
            }
            let val = ALPHABET.iter().position(|&b| b == ch as u8).ok_or("Invalid base64 character")? as u32;
            buffer = (buffer << 6) | val;
            bits_collected += 6;

            if bits_collected >= 8 {
                bits_collected -= 8;
                result.push((buffer >> bits_collected) as u8);
            }
        }
        Ok(result)
    }
}
