use serde::{Deserialize, Serialize};
use validator::Validate;

/// Input validation for creating a new job.
#[derive(Debug, Validate, Deserialize, Serialize)]
pub struct CreateJobInput {
    #[validate(length(min = 1, max = 200, message = "职位标题不能为空且不超过200字符"))]
    pub title: String,
    pub department: Option<String>,
    #[validate(range(min = 0.0, message = "薪资下限不能为负数"))]
    pub salary_min: Option<f64>,
    #[validate(range(min = 0.0, message = "薪资上限不能为负数"))]
    pub salary_max: Option<f64>,
    pub description: Option<String>,
    pub requirements: Option<String>,
    pub status: String,
    pub tags: Vec<String>,
    #[validate(range(min = 1, message = "招聘人数至少为1"))]
    pub headcount: Option<i32>,
}

/// Input validation for updating a job.
#[derive(Debug, Validate, Deserialize, Serialize)]
pub struct UpdateJobInput {
    #[validate(length(min = 1, max = 200, message = "职位标题不能为空且不超过200字符"))]
    pub title: Option<String>,
    pub department: Option<String>,
    #[validate(range(min = 0.0, message = "薪资下限不能为负数"))]
    pub salary_min: Option<f64>,
    #[validate(range(min = 0.0, message = "薪资上限不能为负数"))]
    pub salary_max: Option<f64>,
    pub description: Option<String>,
    pub requirements: Option<String>,
    pub status: Option<String>,
    pub tags: Option<Vec<String>>,
    #[validate(range(min = 1, message = "招聘人数至少为1"))]
    pub headcount: Option<i32>,
}

/// Input validation for creating a new candidate.
#[derive(Debug, Validate, Deserialize, Serialize)]
pub struct CreateCandidateInput {
    #[validate(length(min = 1, max = 100, message = "姓名不能为空且不超过100字符"))]
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
    pub education: Option<String>,
    #[validate(range(min = 0, max = 50, message = "工作年限应在 0-50 之间"))]
    pub years_exp: Option<i32>,
    pub source: String,
    pub tags: Vec<String>,
    // V8 enhanced fields
    pub gender: Option<String>,
    pub birth_date: Option<String>,
    pub expected_city: Option<String>,
    pub expected_salary: Option<String>,
    pub graduation_date: Option<String>,
    pub school: Option<String>,
    pub major: Option<String>,
    pub source_detail: Option<String>,
    pub work_experiences: Option<String>,
    pub education_history: Option<String>,
    /// Whether to automatically add to talent pool (for resume imports)
    pub auto_pool: Option<bool>,
}

/// Input validation for updating a candidate.
#[derive(Debug, Validate, Deserialize, Serialize)]
pub struct UpdateCandidateInput {
    #[validate(length(min = 1, max = 100, message = "姓名不能为空且不超过100字符"))]
    pub name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
    pub education: Option<String>,
    #[validate(range(min = 0, max = 50, message = "工作年限应在 0-50 之间"))]
    pub years_exp: Option<i32>,
    pub source: Option<String>,
    pub tags: Option<Vec<String>>,
    // V8 enhanced fields
    pub gender: Option<String>,
    pub birth_date: Option<String>,
    pub expected_city: Option<String>,
    pub expected_salary: Option<String>,
    pub graduation_date: Option<String>,
    pub school: Option<String>,
    pub major: Option<String>,
    pub source_detail: Option<String>,
    pub work_experiences: Option<String>,
    pub education_history: Option<String>,
    pub is_starred: Option<bool>,
}

/// Input validation for data export.
#[derive(Debug, Validate, Deserialize, Serialize)]
pub struct ExportDataInput {
    #[validate(length(min = 1, message = "至少选择一个导出字段"))]
    pub fields: Vec<String>,
    pub field_order: Vec<String>,
    pub format: String,
    pub scope: String,
    pub job_id: Option<String>,
}

/// Generic validation entry point.
pub fn validate_input<T: Validate>(input: &T) -> Result<(), String> {
    input.validate().map_err(|e| e.to_string())
}
