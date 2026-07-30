use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::RwLock;

/// Errors that can occur during Baidu OCR operations.
#[derive(Debug, Error)]
pub enum OcrError {
    #[error("网络请求超时，请检查网络连接")]
    NetworkTimeout,
    #[error("API 错误: {0}")]
    ApiError(String),
    #[error("解析失败: {0}")]
    ParseError(String),
    #[error("未找到默认 OCR 配置")]
    NoConfig,
    #[error("access_token 获取失败: {0}")]
    TokenError(String),
}

impl From<reqwest::Error> for OcrError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            OcrError::NetworkTimeout
        } else {
            OcrError::ApiError(err.to_string())
        }
    }
}

/// Configuration for connecting to Baidu OCR API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrConfig {
    pub id: i64,
    pub provider: String,
    pub api_key: String,
    pub secret_key: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating a new OCR configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOcrConfigInput {
    pub provider: String,
    pub api_key: String,
    pub secret_key: String,
}

/// Input for updating an existing OCR configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOcrConfigInput {
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub secret_key: Option<String>,
    pub is_default: Option<bool>,
}

/// OCR result structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    pub text: String,
    pub words_result: Vec<WordsResult>,
    pub words_result_num: i32,
    pub raw_response: serde_json::Value,
}

/// A single words result entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordsResult {
    pub words: String,
}

/// Access token response from Baidu.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct AccessTokenResponse {
    access_token: String,
    expires_in: i64,
    error: Option<String>,
    error_description: Option<String>,
}

/// Cached access token with expiration time.
#[derive(Debug, Clone)]
struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

impl CachedToken {
    /// Returns true if the token is still valid (with 5-minute buffer).
    fn is_valid(&self) -> bool {
        let now = Instant::now();
        let buffer = Duration::from_secs(300);
        self.expires_at.checked_sub(buffer).map_or(false, |valid_until| now < valid_until)
    }
}

/// Global token cache using OnceLock + RwLock for thread-safe lazy initialization.
static TOKEN_CACHE: OnceLock<RwLock<Option<CachedToken>>> = OnceLock::new();

fn get_token_cache() -> &'static RwLock<Option<CachedToken>> {
    TOKEN_CACHE.get_or_init(|| RwLock::new(None))
}

/// Client for interacting with Baidu OCR API.
pub struct BaiduOcrClient;

impl BaiduOcrClient {
    /// Gets access token from Baidu using API key and secret key.
    /// Uses cached token if still valid (with 5-minute buffer before expiration).
    pub async fn get_access_token(api_key: &str, secret_key: &str) -> Result<String, OcrError> {
        // Check cache first
        let cache = get_token_cache();
        {
            let cached = cache.read().await;
            if let Some(ref token) = *cached {
                if token.is_valid() {
                    return Ok(token.access_token.clone());
                }
            }
        }

        // Cache miss or expired, fetch new token
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| OcrError::ApiError(e.to_string()))?;

        // Use POST body instead of query string to avoid exposing credentials in URLs/logs
        let url = "https://aip.baidubce.com/oauth/2.0/token";

        let resp = client
            .post(url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=client_credentials&client_id={}&client_secret={}",
                api_key, secret_key
            ))
            .send()
            .await?;

        let status = resp.status();
        let text = resp.text().await?;

        if !status.is_success() {
            return Err(OcrError::TokenError(format!(
                "HTTP {}: {}",
                status.as_u16(),
                text.chars().take(200).collect::<String>()
            )));
        }

        let token_resp: AccessTokenResponse = serde_json::from_str(&text)
            .map_err(|e| OcrError::ParseError(format!("Failed to parse token response: {}", e)))?;

        if let Some(error) = token_resp.error {
            return Err(OcrError::TokenError(format!(
                "{}: {}",
                error,
                token_resp.error_description.unwrap_or_default()
            )));
        }

        // Cache the new token
        let new_cached = CachedToken {
            access_token: token_resp.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(token_resp.expires_in as u64),
        };

        {
            let mut cached = cache.write().await;
            *cached = Some(new_cached);
        }

        Ok(token_resp.access_token)
    }

    /// Performs OCR on an image using Baidu's high-accuracy API.
    pub async fn recognize_image(
        api_key: &str,
        secret_key: &str,
        image_base64: &str,
    ) -> Result<OcrResult, OcrError> {
        // Get access token first
        let access_token = Self::get_access_token(api_key, secret_key).await?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| OcrError::ApiError(e.to_string()))?;

        let url = format!(
            "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token={}",
            access_token
        );

        let params = [
            ("image", image_base64),
            ("language_type", "CHN_ENG"),
            ("detect_direction", "true"),
            ("paragraph", "true"),
            ("probability", "true"),
        ];

        let resp = client
            .post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&params)
            .send()
            .await?;

        let status = resp.status();
        let text = resp.text().await?;

        if !status.is_success() {
            return Err(OcrError::ApiError(format!(
                "HTTP {}: {}",
                status.as_u16(),
                text.chars().take(200).collect::<String>()
            )));
        }

        let raw_response: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| OcrError::ParseError(format!("Failed to parse OCR response: {}", e)))?;

        // Check for API errors
        if let Some(error_code) = raw_response.get("error_code") {
            let error_msg = raw_response
                .get("error_msg")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return Err(OcrError::ApiError(format!(
                "Baidu OCR error {}: {}",
                error_code, error_msg
            )));
        }

        // Parse words result
        let words_result_num = raw_response
            .get("words_result_num")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32;

        let words_result: Vec<WordsResult> = raw_response
            .get("words_result")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        let words = item.get("words")?.as_str()?.to_string();
                        Some(WordsResult { words })
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Combine all words into a single text
        let text = words_result
            .iter()
            .map(|w| w.words.as_str())
            .collect::<Vec<&str>>()
            .join("\n");

        Ok(OcrResult {
            text,
            words_result,
            words_result_num,
            raw_response,
        })
    }

    /// Tests the OCR connection by getting an access token.
    pub async fn test_connection(api_key: &str, secret_key: &str) -> Result<String, OcrError> {
        let _token = Self::get_access_token(api_key, secret_key).await?;
        Ok("连接成功".to_string())
    }
}