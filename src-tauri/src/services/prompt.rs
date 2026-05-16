pub const RESUME_PARSE_PROMPT: &str = r#"你是一名专业的简历解析助手。请从以下简历文本中提取结构化信息，以 JSON 格式返回。

要求：
1. 只返回 JSON，不要 markdown 代码块，不要其他文字。
2. 支持中英文简历，英文简历请将关键信息翻译为中文。
3. 缺失字段填 null 或空数组。
4. 尽可能准确提取信息，不要猜测不存在的内容。
5. 工作年限请根据工作经历计算，如果简历明确写出则使用明确的数值。

字段：
- name: 姓名（字符串或null）
- phone: 手机号（字符串或null）
- email: 邮箱（字符串或null）
- gender: 性别（字符串或null，如"男"、"女"）
- birth_date: 出生日期（字符串或null，格式如"1990-01"或"1990年"）
- current_company: 最近一家公司名称（字符串或null）
- current_position: 最近职位名称（字符串或null）
- education: 最高学历（字符串或null，如"高中"、"大专"、"本科"、"硕士"、"博士"）
- years_exp: 工作年限（整数或null）
- expected_salary: 期望薪资（字符串或null，如"15-20k"、"面议"）
- expected_city: 期望工作城市（字符串或null）
- self_introduction: 自我介绍/个人简介（字符串或null，提取简历中的个人总结或自我评价部分）
- skills: 技能列表（字符串数组，提取专业技能、技术栈、证书等）
- work_experiences: 工作经历数组，每个元素包含：
  - company: 公司名称
  - position: 职位名称
  - duration: 工作时间段（如"2020.01-2023.06"或"2020年1月-2023年6月"）
  - description: 工作描述（可选，包含主要职责和成就）
- project_experiences: 项目经历数组，每个元素包含：
  - name: 项目名称
  - role: 担任角色（可选）
  - duration: 项目时间段（可选）
  - description: 项目描述（可选，包含项目内容和个人贡献）
  - technologies: 使用的技术/工具（字符串数组）

简历文本：
"#;

/// Prompt for Layer 2 AI enhancement — re-parses only the fields the user marked as inaccurate.
pub const AI_ENHANCE_PROMPT: &str = r#"你是一名专业的简历解析助手。以下是原始简历文本和当前已解析的数据。
请仅针对【需要重新识别的字段】进行重新提取，其他字段不要返回。

要求：
1. 只返回 JSON，不要 markdown 代码块，不要其他文字。
2. 仅返回"需要重新识别的字段"对应的 JSON 字段，其余字段不要包含在输出中。
3. 支持中英文简历，英文简历请将关键信息翻译为中文。
4. 如果原始文本中确实找不到某字段的信息，返回 null 或空数组。
5. 尽可能准确提取信息，不要猜测不存在的内容。

需要重新识别的字段：
"#;
