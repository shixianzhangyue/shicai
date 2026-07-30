use serde::{Deserialize, Serialize};
use validator::Validate;

/// Deserializes a present field value into `Some(inner)` so that an explicit
/// JSON `null` becomes `Some(None)` (clear the field) while a field that is
/// simply absent stays `None` (leave unchanged). Must be paired with
/// `#[serde(default)]` so missing fields skip this deserializer entirely.
fn present<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

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
///
/// Uses `Option<Option<T>>` for clearable fields to distinguish three states:
/// - `None`           → field absent from payload → leave unchanged
/// - `Some(None)`     → field explicitly `null`   → clear to NULL
/// - `Some(Some(v))`  → field has a value         → update to `v`
#[derive(Debug, Validate, Deserialize, Serialize)]
pub struct UpdateCandidateInput {
    #[validate(length(min = 1, max = 100, message = "姓名不能为空且不超过100字符"))]
    pub name: Option<String>,
    #[serde(default, deserialize_with = "present")]
    pub phone: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub email: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub current_company: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub current_position: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub education: Option<Option<String>>,
    // Range validated manually in update_candidate (validator derive does not
    // support nested Option for range checks).
    #[serde(default, deserialize_with = "present")]
    pub years_exp: Option<Option<i32>>,
    pub source: Option<String>,
    pub tags: Option<Vec<String>>,
    // V8 enhanced fields
    #[serde(default, deserialize_with = "present")]
    pub gender: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub birth_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub expected_city: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub expected_salary: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub graduation_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub school: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub major: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub source_detail: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub work_experiences: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub education_history: Option<Option<String>>,
    pub is_starred: Option<bool>,
    pub is_hidden: Option<bool>,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_candidate_distinguishes_absent_null_and_value() {
        // Field absent entirely -> None (leave unchanged)
        let absent: UpdateCandidateInput = serde_json::from_str(r#"{"name":"张三"}"#).unwrap();
        assert!(absent.phone.is_none(), "absent field should be None");

        // Field explicitly null -> Some(None) (clear the field)
        let null: UpdateCandidateInput = serde_json::from_str(r#"{"phone":null}"#).unwrap();
        assert!(matches!(null.phone, Some(None)), "explicit null should be Some(None)");

        // Field with a value -> Some(Some(v)) (update the field)
        let value: UpdateCandidateInput = serde_json::from_str(r#"{"phone":"13800138000"}"#).unwrap();
        assert!(
            matches!(value.phone, Some(Some(ref v)) if v == "13800138000"),
            "value should be Some(Some(v))"
        );
    }

    #[test]
    fn update_candidate_years_exp_three_states() {
        let absent: UpdateCandidateInput = serde_json::from_str(r#"{}"#).unwrap();
        assert!(absent.years_exp.is_none());

        let null: UpdateCandidateInput = serde_json::from_str(r#"{"years_exp":null}"#).unwrap();
        assert!(matches!(null.years_exp, Some(None)));

        let value: UpdateCandidateInput = serde_json::from_str(r#"{"years_exp":5}"#).unwrap();
        assert!(matches!(value.years_exp, Some(Some(5))));
    }

    #[test]
    fn update_candidate_non_clearable_fields_stay_single_option() {
        // is_starred is Option<bool>, not nested: null -> None (unchanged).
        let input: UpdateCandidateInput = serde_json::from_str(r#"{"is_starred":null}"#).unwrap();
        assert!(input.is_starred.is_none());

        let input: UpdateCandidateInput = serde_json::from_str(r#"{"is_starred":true}"#).unwrap();
        assert_eq!(input.is_starred, Some(true));
    }
}
