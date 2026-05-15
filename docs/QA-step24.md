# QA Report — Step 24 智能简历解析

**总体评估：NEED_FIX**

- 前端构建：❌ 失败（Vite / TypeScript 报错）
- 类型检查：❌ 失败（`tsconfig.app.json` 下 4 个 TSX 语法错误）
- 前后端命令对齐：❌ 发现 2 处运行时参数名不匹配
- 功能符合度：⚠️ P0 需求 R-7（百度 ERNIE 支持）无法正常工作

---

## 发现的问题

### 1. [BLOCKER] Settings.tsx 存在未匹配 closing tag，导致构建失败

- **描述**：`src/pages/Settings.tsx` 第 330 行存在多余的 `</div>`，且 LLM 配置 Section 被放置在了主容器 `<div className="max-w-3xl space-y-8">`（第 196 行已关闭）之外。Vite 构建报错：`Unexpected closing "div" tag does not match opening "PageLayout" tag`。`tsc -p tsconfig.app.json` 也报 TS17002/TS1005 等语法错误。
- **严重程度**：blocker
- **涉及文件**：`src/pages/Settings.tsx`（第 320–330 行）
- **建议修复**：
  1. 将第 320–329 行的 LLM Config Section 移动到第 196 行的 `</div>` 之前（即放回 `max-w-3xl` 容器内）；
  2. 删除第 330 行多余的 `</div>`。

```diff
-      </div>
       {/* LLM Config Section */}
       <section>
         ...
       </section>
-     </div>
```
（将 `<section>` 及其内容整体剪切到第 195 行 `</section>` 之后、第 196 行 `</div>` 之前）

---

### 2. [BLOCKER] api.ts 中 `test_llm_connection` 调用参数名与 Rust 不匹配

- **描述**：`api.llmConfigs.test()` 调用时传入的对象键为 `apiKey`、`baseUrl`、`modelName`（camelCase），但 Rust 端 `test_llm_connection` 命令的参数名为 `api_key`、`base_url`、`model_name`（snake_case）。Tauri 的 `invoke` 在解析平铺参数时不会做大小写转换，因此这三个字段在 Rust 端会被识别为空字符串或导致反序列化失败。
- **严重程度**：blocker
- **涉及文件**：
  - `src/lib/api.ts`（第 210–211 行）
  - `src-tauri/src/commands/llm_configs.rs`（第 274–279 行）
- **建议修复**：前端 invoke 的 key 必须与 Rust 参数名完全一致：

```ts
// src/lib/api.ts
invoke<string>('test_llm_connection', {
  provider: config.provider,
  api_key: config.apiKey,
  base_url: config.baseUrl,
  model_name: config.modelName,
})
```

---

### 3. [BLOCKER] api.ts 中 `parse_resume` 调用参数名与 Rust 不匹配

- **描述**：`api.resumeParser.parse()` 传入 `{ filePath }`，但 Rust 端 `parse_resume` 的参数名为 `file_path`。与问题 2 同理，这会导致运行时字段匹配失败。
- **严重程度**：blocker
- **涉及文件**：
  - `src/lib/api.ts`（第 214 行）
  - `src-tauri/src/commands/resume_parser.rs`（第 9 行）
- **建议修复**：

```ts
invoke<ParsedResume>('parse_resume', { file_path: filePath })
```

---

### 4. [MAJOR] LLM Client 将所有 Provider 视为 OpenAI 兼容格式，导致百度 ERNIE / 通义千问 / 讯飞星火无法正常使用

- **描述**：`LlmClient::test_connection` 和 `LlmClient::parse_resume` 对所有 Provider 统一构造 `{base_url}/chat/completions` 并使用 `Authorization: Bearer {api_key}`。但：
  - **百度 ERNIE**：需要 `access_token` 查询参数认证（非 Bearer），且端点结构不同（PRD R-7 要求 P0 支持）。
  - **通义千问**：代码中默认 Base URL 为 `https://dashscope.aliyuncs.com/api/v1`，但 PRD 规定应使用 `https://dashscope.aliyuncs.com/compatible-mode/v1` 才能走 OpenAI 兼容格式；旧 `/api/v1` 端点请求体结构不同。
  - **讯飞星火**：需要基于 `APIKey` + `APISecret` 生成签名，直接 Bearer 认证会失败。
- **严重程度**：major（违反 P0 需求 R-7，且 PRD 明确列出各 Provider 认证差异）
- **涉及文件**：
  - `src-tauri/src/services/llm_client.rs`（第 51–69 行、第 154–191 行、第 194–291 行）
- **建议修复**：
  1. 在 `LlmClient` 中按 `Provider` 分发请求构造逻辑：
     - OpenAI / Custom → 现有 OpenAI 兼容逻辑；
     - 百度 ERNIE → 单独实现 token 换取 + 请求构造；
     - 通义千问 → 将默认 Base URL 修正为 `compatible-mode/v1`；
     - 讯飞星火 → 单独实现签名生成逻辑（或使用其 OpenAI 兼容端点并确认认证方式）。
  2. 若 Step 24 范围有限，可先将非 OpenAI 兼容的 Provider 标记为「暂不可用」或仅保留 OpenAI + Custom，避免用户误选后收到难以理解的 API 错误。

---

### 5. [MAJOR] `parse_resume` 将一切 DB 错误都显示为「请先配置 LLM」

- **描述**：`resume_parser.rs` 第 35 行使用 `.map_err(|_| "请先配置 LLM".to_string())`，把任何 `query_row` 失败（包括 DB 锁定、磁盘 IO 错误、SQL 语法错误）都包装成「未找到配置」的提示，严重误导用户。
- **严重程度**：major
- **涉及文件**：`src-tauri/src/commands/resume_parser.rs`（第 18–35 行）
- **建议修复**：区分 "Query returned no rows"（`rusqlite::Error::QueryReturnedNoRows`）与其他 DB 错误：

```rust
let config: LlmConfig = conn.query_row(...)
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => "请先配置 LLM".to_string(),
        _ => format!("数据库错误: {}", e),
    })?;
```

---

### 6. [MINOR] `deobfuscate_key` 对非法输入静默返回空字符串

- **描述**：`llm_client.rs` 第 306–311 行在 base64 解码失败或 UTF-8 转换失败时，通过 `unwrap_or_default()` 静默返回空字符串。如果数据库中的 `api_key` 字段因某种原因损坏，用户会在不知情的情况下发送空 Key 给 LLM 服务商，导致难以排查的认证失败。
- **严重程度**：minor
- **涉及文件**：`src-tauri/src/services/llm_client.rs`（第 305–312 行）
- **建议修复**：让 `deobfuscate_key` 返回 `Result<String, LlmError>`，在解码失败时返回明确的 `ParseError`。

---

### 7. [MINOR] Provider 切换时会覆盖用户手动修改的 Base URL / 模型名

- **描述**：`LlmConfigPanel.tsx` 的 `useEffect`（第 38–44 行）在 `provider` 变化时无条件将 `baseUrl` 和 `modelName` 重置为默认值，即使用户已经手动编辑过。
- **严重程度**：minor
- **涉及文件**：`src/components/settings/LlmConfigPanel.tsx`（第 34–44 行）
- **建议修复**：仅在当前 `baseUrl` 或 `modelName` 为空（或等于旧 Provider 的默认值）时才自动填充，避免覆盖用户自定义输入。

---

### 8. [MINOR] 默认模型与 PRD 不一致

- **描述**：
  - 百度 ERNIE：代码用 `ernie-lite-8k`，PRD 推荐 `ernie-speed-128k`；
  - 讯飞星火：代码用 `generalv3.5`，PRD 推荐 `lite`。
- **严重程度**：minor
- **涉及文件**：`src-tauri/src/services/llm_client.rs`（第 63–69 行）
- **建议修复**：按 PRD 修正默认值，或在 UI 中提供模型选择列表。

---

### 9. [MINOR] `CandidateForm` 中对 `education` 的 `as EducationLevel` 类型断言可能产生无效值

- **描述**：`CandidateForm.tsx` 第 128 行 `setEducation(result.education as EducationLevel)`。LLM 可能返回 "本科"、"Bachelor" 或其他字符串，直接断言为 `EducationLevel` 会导致 `<select>` 出现未识别的 `value`，虽然不会崩溃，但用户体验不佳。
- **严重程度**：minor
- **涉及文件**：`src/components/candidates/CandidateForm.tsx`（第 128 行）
- **建议修复**：维护一个允许的学历值白名单，仅在匹配时才写入，否则留空或显示「其他」。

---

## 附加发现（非 Step 24 引入，但位于同一代码库）

- `src/lib/api.ts` 中 `api.backup.export` 使用 `{ outputPath: path }`，而 Rust `export_backup` 参数名为 `output_path`；`api.backup.import` 使用 `{ zipPath: path }`，而 Rust `import_backup` 参数名为 `zip_path`。这些**已有命令同样存在 camelCase / snake_case 不匹配**，可能导致备份功能在运行时失败。建议统一排查所有 `invoke` 调用的 key 与 Rust 参数名。

---

## 测试覆盖建议

由于本项目为 Tauri 桌面应用，建议补充以下测试层级：

1. **前端单元测试（Vitest）**
   - `llmConfigStore.ts`：模拟 `api.llmConfigs` 的 CRUD 操作，验证状态更新逻辑；
   - `LlmConfigPanel.tsx`：测试 Provider 切换时的默认值填充行为；
   - `ResumeParseButton.tsx`：测试防抖逻辑和阶段流转（`idle → selecting → extracting → parsing → preview → filled`）。

2. **Rust 单元测试（cargo test）**
   - `obfuscate_key` / `deobfuscate_key`：验证 round-trip 正确性、边界条件（空串、Unicode）；
   - `extract_text`：使用 fixtures（sample.pdf、sample.docx、sample.txt）验证文本提取结果；
   - `Provider::from_str`：验证大小写不敏感和未知 Provider 错误；
   - `LlmClient::parse_resume` 的 JSON 解析分支：模拟各种 LLM 返回（标准 JSON、markdown 包裹、缺失字段、错误 HTTP 响应）。

3. **端到端 / 集成测试**
   - 使用 Tauri 的 `WebDriver` 或 `tauri-driver` 编写一条完整用户路径：
     设置页添加 Custom Provider（指向本地 mock server）→ 保存为默认 → 候选人表单点击「智能解析」→ 选择简历文件 → 验证表单回填。

---

## 智能路由判定

| 问题 | 路由目标 | 说明 |
|------|----------|------|
| 1. Settings.tsx 未匹配标签 | **工程师 (Alex)** | 源码 JSX 结构错误 |
| 2. `test_llm_connection` 参数名不匹配 | **工程师 (Alex)** | 源码 api.ts 调用键名错误 |
| 3. `parse_resume` 参数名不匹配 | **工程师 (Alex)** | 源码 api.ts 调用键名错误 |
| 4. Provider 统一使用 OpenAI 格式 | **工程师 (Alex)** | 源码 llm_client.rs 缺少按 Provider 分发请求逻辑 |
| 5. DB 错误被掩盖为「请先配置 LLM」 | **工程师 (Alex)** | 源码 resume_parser.rs 错误处理不当 |
| 6. `deobfuscate_key` 静默失败 | **工程师 (Alex)** | 源码 llm_client.rs 错误处理不当 |
| 7. Provider 切换覆盖用户输入 | **工程师 (Alex)** | 源码 LlmConfigPanel.tsx 交互逻辑问题 |
| 8. 默认模型与 PRD 不一致 | **工程师 (Alex)** | 源码 llm_client.rs 默认值配置错误 |
| 9. education 类型断言 | **工程师 (Alex)** | 源码 CandidateForm.tsx 类型安全 |

**结论**：本轮 QA 发现 **3 个 BLOCKER**（构建失败 + 2 处运行时参数名不匹配）和 **2 个 MAJOR**（Provider 兼容性问题 + 错误信息误导）。建议工程师优先修复 3 个 BLOCKER，以确保项目可编译、基础调用链可运行；随后处理 Provider 分发逻辑和错误处理改进。
