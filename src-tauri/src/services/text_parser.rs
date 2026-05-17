use regex::Regex;
use crate::services::llm_client::ParsedResume;

/// Parse resume text using regex patterns to extract structured fields.
/// Used in OCR-only / text-only mode when LLM is not configured.
pub fn parse_resume_text_regex(raw_text: &str) -> ParsedResume {
    let name = extract_name(raw_text);
    let phone = extract_phone(raw_text);
    let email = extract_email(raw_text);
    let gender = extract_gender(raw_text);
    let birth_date = extract_birth_date(raw_text);
    let education = extract_education(raw_text);
    let years_exp = extract_years_exp(raw_text);
    let expected_salary = extract_expected_salary(raw_text);
    let current_company = extract_current_company(raw_text);
    let current_position = extract_current_position(raw_text);
    let expected_city = extract_expected_city(raw_text);
    let skills = extract_skills(raw_text);

    ParsedResume {
        name,
        phone,
        email,
        gender,
        birth_date,
        current_company,
        current_position,
        education,
        years_exp,
        expected_salary,
        expected_city,
        self_introduction: None,
        skills,
        work_experiences: vec![],
        project_experiences: vec![],
        raw_text_preview: raw_text.chars().take(1000).collect::<String>(),
        raw_text_full: raw_text.to_string(),
        parse_source: "ocr_regex".to_string(),
    }
}

/// Extract name - look for common name patterns at the beginning of resume
fn extract_name(text: &str) -> Option<String> {
    // Try to find name at the beginning of the resume
    // Common patterns: "姓名：张三", "姓名:张三", "张三", etc.
    let name_patterns = vec![
        r"姓\s*名[：:]\s*([^\s\n]{2,4})",
        r"^([^\s\n]{2,4})\s*$",  // Name alone on first line
    ];

    for pattern in name_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(name_match) = caps.get(1) {
                    let name = name_match.as_str().trim();
                    // Validate: should be 2-4 characters, not contain digits or special chars
                    if name.len() >= 2 && name.len() <= 4 && !name.chars().any(|c| c.is_numeric() || "!@#$%^&*()".contains(c)) {
                        return Some(name.to_string());
                    }
                }
            }
        }
    }

    None
}

/// Extract phone number (11-digit Chinese mobile)
fn extract_phone(text: &str) -> Option<String> {
    let phone_regex = Regex::new(r"1[3-9]\d{9}").ok()?;
    phone_regex.find(text).map(|m| m.as_str().to_string())
}

/// Extract email address
fn extract_email(text: &str) -> Option<String> {
    let email_regex = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").ok()?;
    email_regex.find(text).map(|m| m.as_str().to_string())
}

/// Extract gender
fn extract_gender(text: &str) -> Option<String> {
    let gender_patterns = vec![
        (r"性\s*别[：:]\s*男", "男"),
        (r"性\s*别[：:]\s*女", "女"),
        (r"性别[：:]男", "男"),
        (r"性别[：:]女", "女"),
    ];

    for (pattern, gender) in gender_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if re.is_match(text) {
                return Some(gender.to_string());
            }
        }
    }

    None
}

/// Extract birth date (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD patterns)
fn extract_birth_date(text: &str) -> Option<String> {
    let date_patterns = vec![
        r"出\s*生\s*日\s*期[：:]\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})",
        r"出\s*生\s*年\s*月[：:]\s*(\d{4}[-./]\d{1,2})",
        r"(\d{4}[-./]\d{1,2}[-./]\d{1,2})",  // General date pattern
    ];

    for pattern in date_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(date_match) = caps.get(1) {
                    let date_str = date_match.as_str();
                    // Validate year is reasonable (1950-2010)
                    if let Some(year_str) = date_str.get(..4) {
                        if let Ok(year) = year_str.parse::<i32>() {
                            if year >= 1950 && year <= 2010 {
                                return Some(date_str.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

/// Extract education level
fn extract_education(text: &str) -> Option<String> {
    let education_keywords = vec![
        ("博士", "博士"),
        ("硕士", "硕士"),
        ("研究生", "硕士"),
        ("本科", "本科"),
        ("学士", "本科"),
        ("大专", "大专"),
        ("专科", "大专"),
        ("高中", "高中"),
    ];

    // First try to find education field label
    let edu_field_regex = Regex::new(r"学\s*历[：:]\s*([^\s\n]+)").ok()?;
    if let Some(caps) = edu_field_regex.captures(text) {
        if let Some(edu_match) = caps.get(1) {
            let edu_text = edu_match.as_str();
            for (keyword, level) in &education_keywords {
                if edu_text.contains(keyword) {
                    return Some(level.to_string());
                }
            }
        }
    }

    // If no field label, search for keywords in text
    for (keyword, level) in &education_keywords {
        if text.contains(keyword) {
            return Some(level.to_string());
        }
    }

    None
}

/// Extract years of experience
fn extract_years_exp(text: &str) -> Option<i32> {
    let exp_patterns = vec![
        r"工\s*作\s*经\s*验[：:]\s*(\d+)\s*年",
        r"(\d+)\s*年\s*工\s*作\s*经\s*验",
        r"(\d+)\s*年\s*经\s*验",
        r"工\s*作\s*年\s*限[：:]\s*(\d+)\s*年",
    ];

    for pattern in exp_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(years_match) = caps.get(1) {
                    if let Ok(years) = years_match.as_str().parse::<i32>() {
                        if years >= 0 && years <= 50 {
                            return Some(years);
                        }
                    }
                }
            }
        }
    }

    None
}

/// Extract expected salary
fn extract_expected_salary(text: &str) -> Option<String> {
    let salary_patterns = vec![
        r"期\s*望\s*薪\s*资[：:]\s*(\d+[-~]\d+[kK万])",
        r"期\s*望\s*薪\s*资[：:]\s*(\d+[kK万])",
        r"期\s*望\s*薪\s*酬[：:]\s*(\d+[-~]\d+[kK万])",
        r"期\s*望\s*薪\s*酬[：:]\s*(\d+[kK万])",
        r"薪\s*资[：:]\s*(\d+[-~]\d+[kK万])",
        r"(\d+[-~]\d+[kK万])",  // General salary pattern
    ];

    for pattern in salary_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(salary_match) = caps.get(1) {
                    return Some(salary_match.as_str().to_string());
                }
            }
        }
    }

    None
}

/// Extract current company
fn extract_current_company(text: &str) -> Option<String> {
    let company_patterns = vec![
        r"公\s*司\s*名\s*称[：:]\s*([^\n]+)",
        r"工\s*作\s*单\s*位[：:]\s*([^\n]+)",
        r"所\s*在\s*公\s*司[：:]\s*([^\n]+)",
        r"现\s*任\s*公\s*司[：:]\s*([^\n]+)",
    ];

    for pattern in company_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(company_match) = caps.get(1) {
                    let company = company_match.as_str().trim();
                    if !company.is_empty() && company.len() <= 50 {
                        return Some(company.to_string());
                    }
                }
            }
        }
    }

    None
}

/// Extract current position
fn extract_current_position(text: &str) -> Option<String> {
    let position_patterns = vec![
        r"职\s*位[：:]\s*([^\n]+)",
        r"岗\s*位[：:]\s*([^\n]+)",
        r"职\s*务[：:]\s*([^\n]+)",
        r"担\s*任[：:]\s*([^\n]+)",
    ];

    for pattern in position_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(pos_match) = caps.get(1) {
                    let position = pos_match.as_str().trim();
                    if !position.is_empty() && position.len() <= 30 {
                        return Some(position.to_string());
                    }
                }
            }
        }
    }

    None
}

/// Extract expected city
fn extract_expected_city(text: &str) -> Option<String> {
    let city_patterns = vec![
        r"期\s*望\s*城\s*市[：:]\s*([^\n]+)",
        r"期\s*望\s*工\s*作\s*地[：:]\s*([^\n]+)",
        r"工\s*作\s*地\s*点[：:]\s*([^\n]+)",
        r"现\s*居\s*地[：:]\s*([^\n]+)",
    ];

    for pattern in city_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(city_match) = caps.get(1) {
                    let city = city_match.as_str().trim();
                    if !city.is_empty() && city.len() <= 20 {
                        return Some(city.to_string());
                    }
                }
            }
        }
    }

    None
}

/// Extract skills
fn extract_skills(text: &str) -> Vec<String> {
    let mut skills = Vec::new();

    // Common technical skills to look for
    let skill_keywords = vec![
        "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "PHP", "Ruby",
        "React", "Vue", "Angular", "Node.js", "Express", "Django", "Flask", "Spring", "Laravel",
        "MySQL", "PostgreSQL", "MongoDB", "Redis", "Oracle", "SQL Server",
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "Git",
        "HTML", "CSS", "SASS", "LESS", "Webpack", "Vite",
        "TensorFlow", "PyTorch", "Machine Learning", "Deep Learning", "NLP", "CV",
        "Agile", "Scrum", "Project Management", "Product Management",
    ];

    // Try to find skills section
    let skills_section_regex = Regex::new(r"(?s)技\s*能[：:]\s*([^\n]+(?:\n[^\n]+)*)").ok();
    if let Some(re) = skills_section_regex {
        if let Some(caps) = re.captures(text) {
            if let Some(skills_text) = caps.get(1) {
                let skills_str = skills_text.as_str();
                for skill in &skill_keywords {
                    if skills_str.contains(skill) {
                        skills.push(skill.to_string());
                    }
                }
            }
        }
    }

    // If no skills section found, search in entire text
    if skills.is_empty() {
        for skill in &skill_keywords {
            if text.contains(skill) {
                skills.push(skill.to_string());
            }
        }
    }

    skills
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_phone() {
        assert_eq!(extract_phone("电话：13812345678"), Some("13812345678".to_string()));
        assert_eq!(extract_phone("手机: 15900001111"), Some("15900001111".to_string()));
        assert_eq!(extract_phone("无电话"), None);
    }

    #[test]
    fn test_extract_email() {
        assert_eq!(extract_email("邮箱：test@example.com"), Some("test@example.com".to_string()));
        assert_eq!(extract_email("Email: user@company.cn"), Some("user@company.cn".to_string()));
    }

    #[test]
    fn test_extract_education() {
        assert_eq!(extract_education("学历：本科"), Some("本科".to_string()));
        assert_eq!(extract_education("硕士学位"), Some("硕士".to_string()));
    }

    #[test]
    fn test_extract_years_exp() {
        assert_eq!(extract_years_exp("工作经验：5年"), Some(5));
        assert_eq!(extract_years_exp("3年工作经验"), Some(3));
    }

    #[test]
    fn test_extract_expected_salary() {
        assert_eq!(extract_expected_salary("期望薪资：15-20K"), Some("15-20K".to_string()));
        assert_eq!(extract_expected_salary("薪资：20K"), Some("20K".to_string()));
    }
}
