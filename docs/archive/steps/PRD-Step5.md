# PRD-Step5: 职位 CRUD（含软删除）

## 1. 功能目标
实现职位（Job）的完整增删改查，其中删除为软删除并记录审计日志；列表页支持状态切换、复制和标签绑定。

## 2. 用户故事

- **US-1**：作为招聘负责人，我可以新建、编辑职位信息并绑定标签，以便统一管理招聘需求。
- **US-2**：作为招聘负责人，我可以在列表页一键切换职位状态（草稿/开放/暂停/关闭），并复制已有职位快速创建相似岗位。
- **US-3**：作为招聘负责人，我删除职位时会收到二次确认，并知晓该操作仅为软删除、可追踪，避免误删造成数据丢失。

## 3. 需求池

### P0 — 必须完成
- [ ] **P0-1** `jobs.rs` 实现 6 个 commands（见第 5 节），`delete_job` 为软删除并写入 `audit_logs`。
- [ ] **P0-2** `list_jobs` 必须过滤 `deleted_at IS NULL` 的记录；返回结果按 `created_at DESC` 排序。
- [ ] **P0-3** 前端 `jobStore`（Zustand）封装异步 CRUD 状态管理，模式对齐 `tagStore`。
- [ ] **P0-4** 前端 `api.ts` 新增 `api.jobs` 命名空间，调用 Rust commands。
- [ ] **P0-5** `Jobs` 页面实现职位列表（表格/卡片）、新建/编辑表单（`JobForm` 对话框）、状态切换按钮、复制按钮。
- [ ] **P0-6** 删除操作必须弹出二次确认 Dialog，文案说明为软删除及影响范围。
- [ ] **P0-7** 新建/编辑表单集成 `TagPicker`（复用 Step 4），`tags` 字段在 DB 中以 JSON 文本存储，前后端负责序列化/反序列化。
- [ ] **P0-8** 表单输入使用 `validate.rs` 中的 `CreateJobInput` / `UpdateJobInput` 进行校验（已在后端 derive `Validate`）。
- [ ] **P0-9** `lib.rs` 的 `invoke_handler` 注册新增 commands。

### P1 — 建议完成
- [ ] **P1-1** 列表页支持按标题/部门搜索过滤。
- [ ] **P1-2** 列表页支持按状态筛选（全部/草稿/开放/暂停/关闭）。
- [ ] **P1-3** 复制职位时，新职位标题自动追加 `（副本）` 前缀，状态重置为 `draft`。

### P2 — 可选
- [ ] **P2-1** 列表页分页或虚拟滚动（当前数据量下可暂不实现）。
- [ ] **P2-2** 职位表单支持从 `job_templates` 表选择模板快速填充。

## 4. 页面/组件设计

### 4.1 Jobs 页面布局
基于现有 `PageLayout`，整体结构：

```
┌─────────────────────────────────────────────┐
│  职位管理                         [+ 新建职位] │
├─────────────────────────────────────────────┤
│  [搜索框]  [状态筛选 ▼]                      │
├─────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ 职位卡片 │ │ 职位卡片 │ │ 职位卡片 │  ... │
│  └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────┘
```

- **顶部操作栏**：左侧为搜索框 + 状态筛选下拉，右侧为「新建职位」按钮。
- **列表区域**：采用卡片网格布局，每张卡片展示：职位标题、部门、薪资范围、状态标签、关联标签（色块）、操作按钮（编辑 / 复制 / 删除 / 状态切换）。
- **空状态**：当前占位内容可复用，替换文案为「暂无职位，点击新建职位开始」。

### 4.2 JobForm 表单字段（新建/编辑对话框）
使用 shadcn/ui `Dialog` + `Input` / `Textarea` / `Select`：

| 字段 | 组件 | 必填 | 校验规则 |
|------|------|------|----------|
| 职位标题 | Input | 是 | 1-200 字符 |
| 所属部门 | Input | 否 | - |
| 薪资下限 | Input (number) | 否 | ≥ 0 |
| 薪资上限 | Input (number) | 否 | ≥ 0，需 ≥ 下限（前端校验） |
| 职位描述 | Textarea | 否 | - |
| 岗位要求 | Textarea | 否 | - |
| 状态 | Select | 是 | draft / open / paused / closed |
| 标签 | TagPicker | 否 | 复用 Step 4 组件 |

- 提交按钮文案：新建时「创建职位」，编辑时「保存修改」。
- 取消/关闭时若表单有变更，可提示未保存（P1 可选）。

### 4.3 删除确认弹窗文案

> **确认删除职位？**
>
> 职位「{title}」将被移至回收站（软删除）。关联的候选人 pipeline 数据不会丢失，但不再显示在当前列表中。此操作会被记录到审计日志。
>
> [取消]  [确认删除]

## 5. Rust Commands 清单

所有 commands 位于 `src-tauri/src/commands/jobs.rs`，需在 `lib.rs` 注册。

| Command | 签名 | 职责 |
|---------|------|------|
| `list_jobs` | `fn list_jobs(state: State<DbPool>) -> Result<Vec<Job>, String>` | 查询 `deleted_at IS NULL` 的所有职位，按 `created_at DESC` 排序。`tags` 字段从 JSON 文本反序列化为 `Vec<String>`。 |
| `get_job` | `fn get_job(state: State<DbPool>, id: String) -> Result<Job, String>` | 根据 ID 查询单个未删除职位；不存在返回错误。 |
| `create_job` | `fn create_job(state: State<DbPool>, input: CreateJobInput) -> Result<Job, String>` | 调用 `validate_input(&input)` 校验；生成 nanoid；`tags` 序列化为 JSON 文本；插入 DB；返回完整 Job。 |
| `update_job` | `fn update_job(state: State<DbPool>, id: String, input: UpdateJobInput) -> Result<Job, String>` | 调用 `validate_input(&input)` 校验；动态构建 UPDATE SQL（仅更新传入字段）；`updated_at` 设为当前时间；返回更新后 Job。 |
| `delete_job` | `fn delete_job(state: State<DbPool>, id: String) -> Result<(), String>` | **软删除**：先查询该记录完整数据 → 写入 `audit_logs`（`action='soft_delete'`、`old_data` 为 JSON 快照）→ 更新 `jobs` 设置 `deleted_at = now()`。 |
| `duplicate_job` | `fn duplicate_job(state: State<DbPool>, id: String) -> Result<Job, String>` | 根据原 ID 查询数据 → 生成新 nanoid → 标题加 `（副本）`、状态设为 `draft` → 插入新记录 → 返回新 Job。 |

### Rust Job 返回结构
```rust
#[derive(Debug, Serialize)]
pub struct Job {
    pub id: String,
    pub title: String,
    pub department: Option<String>,
    pub salary_min: Option<f64>,
    pub salary_max: Option<f64>,
    pub description: Option<String>,
    pub requirements: Option<String>,
    pub status: String,
    pub tags: Vec<String>,      // DB JSON 文本反序列化
    pub created_at: String,
    pub updated_at: String,
}
```

## 6. 数据流

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│  React UI   │────▶│  jobStore   │────▶│    api.jobs.*    │────▶│  invoke  │
│ (Jobs.tsx)  │◄────│ (Zustand)   │◄────│   (src/lib/api)  │◄────│  (Tauri) │
└─────────────┘     └─────────────┘     └──────────────────┘     └────┬─────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │ jobs.rs Cmd  │
                                                               │  (Rust)      │
                                                               └──────┬───────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │  DbPool/r2d2 │
                                                               │   SQLite     │
                                                               └──────────────┘
```

### 调用链示例（创建职位）
1. 用户点击「新建职位」→ 打开 `JobForm` Dialog。
2. 填写表单 → 提交 → 调用 `jobStore.createJob(data)`。
3. `jobStore` 设置 `loading: true` → 调用 `api.jobs.create(data)`。
4. `api.jobs.create` 通过 `invoke('create_job', { input: data })` 调用 Rust。
5. Rust `create_job`：校验 → 写 DB → 返回 `Job`。
6. `jobStore` 将新 Job 追加到 `jobs` 列表头部，设置 `loading: false`。

## 7. 待确认问题

| 编号 | 问题 | 建议方案 |
|------|------|----------|
| Q1 | `salary_max` 是否必须在 DB/校验中强制 `≥ salary_min`？ | 后端 `validate.rs` 暂不增加跨字段校验，由前端表单做 `salary_max ≥ salary_min` 提示即可。 |
| Q2 | `duplicate_job` 的薪资、描述等字段是否全部复制？ | 全部复制，仅标题加前缀、状态重置为 `draft`、ID 与时间为新生成。 |
| Q3 | 状态切换在列表页是行内操作（如 Switch/Select）还是打开编辑表单？ | 建议行内 `Select` 下拉快速切换，直接调用 `update_job` 修改状态字段。 |
| Q4 | 列表页布局使用卡片网格还是表格？ | 卡片网格更利于展示标签和状态；若后续字段膨胀可切换表格。 |

---

**版本**: Step 5  
**日期**: 2025-05-14  
**依赖**: Step 4（TagPicker、tags.rs 模式）
