# TalentVault Step 24 增量 PRD：智能解析

## 1. 功能目标

接入在线 LLM API 实现简历智能解析，用户可自定义 API Provider、Key 及模型参数；解析结果自动填充候选人表单，减少手动录入成本。

## 2. 用户故事

| 编号 | 用户故事 |
|------|----------|
| US-1 | 作为招聘管理员，我可以在设置页配置 LLM API（Provider、API Key、Base URL、模型名），以便后续使用自定义模型解析简历。 |
| US-2 | 作为招聘管理员，我可以在设置页测试 LLM 连接，以便确认配置可用后再保存。 |
| US-3 | 作为招聘管理员，我可以在候选人新增/编辑页点击「智能解析」按钮上传简历，让系统自动提取结构化信息并自动填充表单。 |
| US-4 | 作为招聘管理员，我可以在解析完成后预览解析结果（原始文本与提取字段对照），并选择确认填充或取消，避免错误数据入库。 |
| US-5 | 作为招聘管理员，我希望解析过程有进度反馈，以便了解上传、传输、解析各阶段状态。 |

## 3. 需求池

### P0（必须实现）

| 编号 | 需求 | 验收标准 |
|------|------|----------|
| R-1 | 设置页新增「LLM 配置」Tab | 包含 Provider 选择器、API Key 输入框、Base URL 输入框、模型名称输入框、保存/测试按钮 |
| R-2 | `llm_configs` 表 CRUD | 支持保存、读取、更新、删除配置；字段完整，含 `is_default` 标记 |
| R-3 | 候选人新增/编辑页添加「智能解析」入口 | 点击后打开文件选择器，仅接受 PDF/DOCX/TXT |
| R-4 | 后端 LLM 解析 Command | 读取简历文本 → 构造 Prompt → 调用 LLM API → 返回结构化 JSON；必须通过 DbPool 获取连接 |
| R-5 | 解析结果自动填充表单 | 提取字段（姓名、电话、邮箱、工作年限、技能、教育经历、工作经历）映射到候选人表单对应字段 |
| R-6 | 前端防抖与加载状态 | 上传按钮防抖 300ms；解析过程显示进度条/加载动画，禁止重复提交 |
| R-7 | 支持至少 2 个内置 Provider（OpenAI + 百度 ERNIE） | 用户选择 Provider 后自动填充默认 Base URL 和模型名，允许手动覆盖 |

### P1（建议实现）

| 编号 | 需求 | 验收标准 |
|------|------|----------|
| R-8 | 支持通义千问、讯飞星火 Provider | 提供默认 Base URL 和推荐模型列表 |
| R-9 | 解析结果预览面板 | 弹窗展示原始文本摘要与提取字段，用户勾选确认后填充 |
| R-10 | LLM 连接测试 | 点击测试按钮发送一条简单请求，返回成功/失败提示 |
| R-11 | API Key 加密存储 | 使用 Tauri 的安全存储或 sqlite 加密字段，禁止明文落盘 |
| R-12 | 解析超时与错误提示 | API 调用超时 60s，超时或报错时前端给出友好提示（非崩溃） |

### P2（可选）

| 编号 | 需求 | 验收标准 |
|------|------|----------|
| R-13 | 自定义兼容 OpenAI API 格式的 Provider | 允许用户手动输入任意兼容 OpenAI API 格式的第三方服务 |
| R-14 | 解析历史记录 | 记录每次解析的原始文本、结果、耗时、成功与否，用于后续调优 |
| R-15 | 批量简历解析 | 支持一次上传多份简历，批量解析并生成候选人草稿 |
| R-16 | 解析模板/Prompt 自定义 | 高级用户可编辑解析 Prompt，调整提取字段和格式 |

## 4. UI/UX 设计稿描述

### 4.1 LLM 配置面板（设置页新增 Tab）

布局：设置页新增第四个 Tab「LLM 配置」，位于「导出配置」「备份恢复」之后。

内容结构（从上到下）：

1. **Provider 选择器**
   - 下拉框选项：`OpenAI`、`百度 ERNIE`、`通义千问`、`讯飞星火`、`自定义（OpenAI 兼容）`
   - 选择内置 Provider 后，自动填充默认 Base URL 和推荐模型名；选择「自定义」后全部手动输入。

2. **Base URL 输入框**
   - 文本输入，带占位符提示（如 `https://api.openai.com/v1`）
   - 允许用户覆盖默认值

3. **API Key 输入框**
   - 密码型输入（显示为圆点），右侧带「显示/隐藏」切换图标
   - 占位符：`sk-...` 或对应格式提示

4. **模型名称输入框**
   - 文本输入，选择内置 Provider 时自动填充推荐值（如 `gpt-4o-mini`、`ernie-speed-128k`）

5. **操作按钮区**
   - 「测试连接」：发送一条简单请求验证配置，按钮旁显示测试结果（绿色 ✓ / 红色 ✗ + 错误信息）
   - 「保存配置」：保存当前配置到 `llm_configs` 表
   - 「设为默认」：将当前配置标记为 `is_default = 1`，其他配置自动取消默认

6. **配置列表（可选，P1）**
   - 已保存的配置卡片列表，显示 Provider + 模型名 + 默认标记，支持编辑/删除

### 4.2 简历解析触发入口（候选人新增/编辑页）

布局：在候选人表单顶部或侧边栏新增「智能解析」区域。

内容结构：

1. **智能解析按钮**
   - 主按钮样式，文案「📄 智能解析简历」
   - 点击后唤起系统文件选择器，过滤 `.pdf`、`.docx`、`.txt`

2. **文件信息展示**
   - 选择文件后显示文件名 + 文件大小
   - 提供「重新选择」按钮

3. **进度条 / 状态指示**
   - 阶段：上传 → 读取文本 → 调用 LLM → 解析完成
   - 使用线性进度条或步骤条展示当前阶段
   - 解析中按钮置灰，禁止重复点击（防抖 300ms + 状态锁）

4. **解析结果预览面板（P1，弹窗/抽屉）**
   - 左侧：原始简历文本摘要（前 1000 字符，可展开）
   - 右侧：提取字段列表（姓名、电话、邮箱、技能、工作年限、教育、工作经历）
   - 每个字段可手动编辑修正
   - 底部按钮：「确认填充」（写入表单）/ 「取消」（丢弃结果）

5. **解析失败提示**
   - 弹窗提示失败原因（网络超时、API Key 无效、文件格式不支持等）
   - 提供「重试」和「手动录入」选项

## 5. 数据模型

### 5.1 新增表：`llm_configs`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `provider` | `TEXT` | NOT NULL | Provider 标识：`openai`、`baidu_ernie`、`qwen`、`xunfei`、`custom` |
| `api_key` | `TEXT` | NOT NULL | API Key（建议加密存储） |
| `base_url` | `TEXT` | NOT NULL | API Base URL |
| `model_name` | `TEXT` | NOT NULL | 模型名称 |
| `is_default` | `INTEGER` | NOT NULL DEFAULT 0 | 是否为默认配置（0=否，1=是） |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | 创建时间 |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | 更新时间 |

约束：
- 唯一约束：`(provider, model_name)` 可选，视实现而定
- 触发器：更新时自动刷新 `updated_at`

### 5.2 迁移脚本（refinery 格式）

```sql
-- V__add_llm_configs.sql
CREATE TABLE llm_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    api_key TEXT NOT NULL,
    base_url TEXT NOT NULL,
    model_name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER llm_configs_updated_at
AFTER UPDATE ON llm_configs
FOR EACH ROW
BEGIN
    UPDATE llm_configs SET updated_at = datetime('now') WHERE id = NEW.id;
END;
```

### 5.3 枚举与常量建议

- `Provider` 枚举（Rust）：`OpenAI`、`BaiduErnie`、`Qwen`、`Xunfei`、`Custom`
- 默认 Base URL 字典：
  - OpenAI: `https://api.openai.com/v1`
  - 百度 ERNIE: `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat`
  - 通义千问: `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - 讯飞星火: `https://spark-api-open.xf-yun.com/v1`
- 默认模型推荐：
  - OpenAI: `gpt-4o-mini`
  - 百度 ERNIE: `ernie-speed-128k`
  - 通义千问: `qwen-turbo`
  - 讯飞星火: `lite`

## 6. 技术选型建议

### 6.1 支持的 LLM Provider

| Provider | 认证方式 | 请求格式 | 备注 |
|----------|----------|----------|------|
| **OpenAI** | Bearer Token (`Authorization: Bearer sk-...`) | OpenAI Chat Completions API | 基准实现，所有兼容 API 均以其为模板 |
| **百度 ERNIE** | Access Token（需先通过 API Key/Secret 换取） | 类 OpenAI，但需额外 Token 获取步骤 | 国内可用，中文理解好 |
| **通义千问** | Bearer Token (`Authorization: Bearer sk-...`) | OpenAI 兼容格式 | 阿里云出品，国内稳定 |
| **讯飞星火** | Bearer Token + API Key + API Secret | OpenAI 兼容格式 | 需签名生成 |
| **自定义（OpenAI 兼容）** | Bearer Token（或其他自定义） | OpenAI Chat Completions API | 如 DeepSeek、Gemini（OpenAI 兼容层）、私有化部署等 |

### 6.2 后端实现建议

- **HTTP 客户端**：使用 `reqwest`（已广泛用于 Rust 生态），支持异步和超时配置
- **Prompt 工程**：使用系统 Prompt 固定输出格式（JSON Schema），要求 LLM 返回可解析的结构化数据
- **文本提取**：
  - PDF → `pdf-extract` 或 `lopdf` + 文本提取
  - DOCX → `docx-rs` 读取文本
  - TXT → 直接读取
- **错误处理**：统一封装 LLM 调用层，返回 `Result<ParsedResume, ParseError>`，错误类型包含：网络超时、API 错误、格式解析失败、内容为空

### 6.3 前端实现建议

- **文件上传**：使用 Tauri `open` API 调用系统文件选择器，读取文件后通过 Tauri Command 传递至后端
- **状态管理**：使用 React Context 或局部 state 管理解析进度（idle → selecting → uploading → parsing → preview → filled）
- **防抖**：使用 `lodash.debounce` 或自定义 hook，上传按钮 300ms 防抖
- **表单填充**：解析结果通过回调写入表单 state，字段缺失时留空不覆盖已有值

## 7. 待确认问题

| 编号 | 问题 | 建议方案 | 决策人 |
|------|------|----------|--------|
| Q-1 | **API Key 如何安全存储？** | 方案 A：使用 Tauri `secure-store` 插件存 Key，sqlite 只存配置元数据；方案 B：sqlite 中用 AES 加密 api_key 字段，密钥由用户主密码派生。建议方案 A。 | 架构师 |
| Q-2 | **LLM 调用超时时间？** | 建议总超时 60s（上传 10s + 解析 50s），其中 HTTP 请求超时 45s。超长简历可分段处理。 | 架构师 |
| Q-3 | **重试策略？** | 建议指数退避重试 2 次（1s → 2s），仅针对网络超时/5xx 错误，4xx 错误不重试。是否实现？ | 架构师 |
| Q-4 | **Prompt 是否硬编码？** | 建议 P0 硬编码，P2 开放自定义。Prompt 版本如何管理？ | 架构师 |
| Q-5 | **解析失败时是否保留原始文本？** | 建议保留到日志或临时表，便于调试和人工二次提取。 | 架构师 |
| Q-6 | **多语言简历支持？** | 英文简历使用 OpenAI 效果最佳，中文简历使用国内 Provider。是否根据简历语言自动选择默认 Provider？ | 产品经理 |
| Q-7 | **是否支持图片型 PDF（扫描件）？** | 图片型 PDF 需要 OCR，当前 Step 24 暂不支持，是否留扩展接口？ | 架构师 |

---

*文档版本: 1.0*  
*编写: Alice (产品经理)*  
*日期: 2026-05-15*
