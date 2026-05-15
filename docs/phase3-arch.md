# TalentVault Phase 3 增量架构设计

> **日期：** 2026-05-15
> **范围：** Step 21, 22, 23, 25
> **基础：** Phase 1-2（Step 1-20）已完成

---

## 1. 实现方案概述

### 1.1 Step 21 - 仪表盘
- `stats.rs` 补充 `get_funnel_data`：按 job_id 分组统计 pipeline 各阶段人数。支持全局（不传 jobId）和单职位模式。
- `Dashboard.tsx` 完全重写：从硬编码 0 改为真实数据，4 张统计卡片连接 `get_overview_stats`，ECharts 堆叠柱状图连接 `get_funnel_data`。
- 暗色主题通过 ECharts `textStyle` 和 `splitLine` 配置覆盖。

### 1.2 Step 22 - 数据导出
- `export.rs` 实现两命令：
  - `get_exportable_fields`：返回 `{ key: ExportableField, label: string }[]`（硬编码元数据）。
  - `export_data`：按 `ExportConfig` 动态查询 candidates，返回 `ExportResult { data: Vec<ExportRow>, fieldOrder: Vec<String> }`。前端用 SheetJS 生成文件。
- `ExportConfig.tsx`：弹窗组件，左侧字段勾选 + 右侧拖拽排序 + 格式/范围选择。

### 1.3 Step 23 - 数据备份与恢复
- `backup.rs` 实现三命令：
  - `export_backup`：zip 异步打包 `data/talent.db` + `res/` 目录。通过 `AppHandle` 获取路径。
  - `import_backup`：校验 zip → 创建 .bak 回滚点 → 解压覆盖 → 提示重启。
  - `rollback_backup`：从最新 .bak 文件恢复数据。
- Settings.tsx 增加「数据管理」区域：导出/导入/回滚 UI。

### 1.4 Step 25 - 职位模板完善 + 流程模板
- 新增数据库迁移 `V4__pipeline_templates.sql`：创建 `pipeline_templates` 表。
- 新建 `pipeline_templates.rs`：list / create / delete commands。
- JobForm（新建模式）增加「流程模板」下拉选择，选择后提交时自动创建对应阶段。
- StageConfig（职位详情页）增加「保存为流程模板」按钮。

---

## 2. 新增/修改文件清单

| # | 文件路径 | 变更类型 | 所属 Step |
|---|---------|---------|----------|
| 1 | `src-tauri/src/commands/stats.rs` | 修改 | 21 |
| 2 | `src-tauri/src/commands/export.rs` | 重写 | 22 |
| 3 | `src-tauri/src/commands/backup.rs` | 重写 | 23 |
| 4 | `src-tauri/src/commands/pipeline_templates.rs` | 新增 | 25 |
| 5 | `src-tauri/src/commands/mod.rs` | 修改 | 21,22,23,25 |
| 6 | `src-tauri/src/lib.rs` | 修改 | 21,22,23,25 |
| 7 | `src-tauri/src/db/migrations/V4__pipeline_templates.sql` | 新增 | 25 |
| 8 | `src-tauri/src/db/migrations/mod.rs` | 修改 | 25 |
| 9 | `src/types/index.ts` | 修改 | 21,22,23,25 |
| 10 | `src/lib/api.ts` | 修改 | 21,22,23,25 |
| 11 | `src/pages/Dashboard.tsx` | 重写 | 21 |
| 12 | `src/components/settings/ExportConfig.tsx` | 新增 | 22 |
| 13 | `src/components/settings/BackupRestore.tsx` | 新增 | 23 |
| 14 | `src/pages/Settings.tsx` | 修改 | 23 |
| 15 | `src/pages/JobTemplates.tsx` | 修改 | 25 |
| 16 | `src/components/jobs/JobForm.tsx`（如有） | 修改 | 25 |

---

## 3. 数据结构与接口定义

### 3.1 Rust 新增结构

```rust
// stats.rs —— FunnelData
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FunnelData {
    pub job_id: String,
    pub job_title: String,
    pub stage_name: String,
    pub count: i64,
}

// export.rs —— ExportableFieldMeta
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableFieldMeta {
    pub key: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub data: Vec<std::collections::HashMap<String, String>>,
    pub field_order: Vec<String>,
}

// backup.rs —— 无需新 struct，返回 String 路径

// pipeline_templates.rs
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineTemplate {
    pub id: String,
    pub name: String,
    pub stages_json: String,
    pub created_at: String,
}
```

### 3.2 TypeScript 类型补充

```typescript
// types/index.ts 新增
export interface FunnelData {
  jobId: string;
  jobTitle: string;
  stageName: string;
  count: number;
}

export interface ExportableFieldMeta {
  key: ExportableField;
  label: string;
}

export interface ExportResult {
  data: Record<ExportableField, string>[];
  fieldOrder: ExportableField[];
}

export interface PipelineTemplate {
  id: string;
  name: string;
  stagesJson: string;
  createdAt: string;
}
```

### 3.3 新增 Commands 签名

```rust
// stats.rs
#[tauri::command]
pub fn get_funnel_data(
    state: tauri::State<DbPool>,
    job_id: Option<String>,
) -> Result<Vec<FunnelData>, String>

// export.rs
#[tauri::command]
pub fn get_exportable_fields() -> Result<Vec<ExportableFieldMeta>, String>

#[tauri::command]
pub fn export_data(
    state: tauri::State<DbPool>,
    config: ExportConfig,
) -> Result<ExportResult, String>

// backup.rs
#[tauri::command]
pub async fn export_backup(
    app: tauri::AppHandle,
    output_path: String,
) -> Result<String, String>

#[tauri::command]
pub async fn import_backup(
    app: tauri::AppHandle,
    zip_path: String,
) -> Result<String, String>

#[tauri::command]
pub fn rollback_backup(app: tauri::AppHandle) -> Result<String, String>

// pipeline_templates.rs
#[tauri::command]
pub fn list_pipeline_templates(state: tauri::State<DbPool>) -> Result<Vec<PipelineTemplate>, String>

#[tauri::command]
pub fn create_pipeline_template(
    state: tauri::State<DbPool>,
    name: String,
    stages_json: String,
) -> Result<PipelineTemplate, String>

#[tauri::command]
pub fn delete_pipeline_template(state: tauri::State<DbPool>, id: String) -> Result<(), String>
```

---

## 4. 程序调用流程

### 4.1 仪表盘数据流
```
Dashboard.tsx (mount)
  ├─ api.stats.overview() ──→ get_overview_stats (Rust)
  │                             └─ 4 条 COUNT SQL
  │                          ←─ OverviewStats { openJobs, ... }
  ├─ api.stats.funnel() ────→ get_funnel_data (Rust)
  │                             └─ JOIN jobs + pipeline_stages + candidate_pipeline
  │                          ←─ FunnelData[]
  └─ 前端 pivot 为 ECharts series
```

### 4.2 导出流程
```
ExportConfig.tsx
  ├─ api.export.fields() ──→ get_exportable_fields (Rust)
  │                          ←─ [{ key, label }]
  └─ 用户确认 → api.export.export(config)
                              → export_data (Rust)
                                ├─ 按 config.scope 构建 WHERE
                                ├─ 按 fieldOrder SELECT
                                └─ tags 转为逗号拼接
                              ←─ ExportResult { data, fieldOrder }
                    ←─ 前端 SheetJS 生成 xlsx/csv + save dialog
```

### 4.3 新建职位 + 流程模板
```
JobForm (新建模式)
  ├─ api.pipelineTemplates.list() ──→ list_pipeline_templates
  │                                    ←─ [{ id, name, stagesJson }]
  ├─ 用户选择流程模板 → 预览阶段列表
  └─ 点击发布
       ├─ api.jobs.create(data) ──→ create_job
       │                              ←─ Job { id }
       └─ IF 选择了模板:
              parse stages_json → stages array
              for each stage: api.pipeline.createStage(jobId, name, sortOrder)
          ELSE:
              api.pipeline.initDefaultStages(jobId)
```

---

## 5. 任务列表（有序，含依赖）

| 编号 | 任务 | 文件 | 前置依赖 | 验收标准 |
|------|------|------|---------|---------|
| 21-1 | stats.rs 补充 get_funnel_data | stats.rs | - | cargo check 通过；SQL JOIN 正确 |
| 21-2 | api.ts 新增 stats API | api.ts | 21-1 | types 正确 |
| 21-3 | Dashboard.tsx 重写 | Dashboard.tsx | 21-2 | 真实数据+图表正常渲染 |
| 22-1 | export.rs 完整实现 | export.rs | - | get_exportable_fields + export_data 均可调用 |
| 22-2 | api.ts 新增 export API | api.ts | 22-1 | - |
| 22-3 | ExportConfig.tsx 组件 | ExportConfig.tsx | 22-2 | 字段勾选/排序/导出可用 |
| 23-1 | backup.rs 完整实现 | backup.rs | - | export/import/rollback 均可调用 |
| 23-2 | api.ts 新增 backup API | api.ts | 23-1 | - |
| 23-3 | BackupRestore.tsx + Settings 集成 | BackupRestore.tsx, Settings.tsx | 23-2 | UI 正常 |
| 25-1 | V4 迁移脚本 + 注册 | V4__pipeline_templates.sql, mod.rs | - | 表创建成功 |
| 25-2 | pipeline_templates.rs | pipeline_templates.rs | 25-1 | CRUD 命令可用 |
| 25-3 | lib.rs / api.ts 注册新命令 | lib.rs, api.ts, types/index.ts | 25-2 | - |
| 25-4 | JobForm 集成流程模板 | JobForm.tsx（或 Jobs.tsx 中的新建逻辑） | 25-3 | 新建职位可选模板 |
| - | lib.rs 全局注册所有新 commands | lib.rs | 全部 | cargo check + tsc --noEmit 通过 |

**实现顺序建议：** 21-1 → 21-2 → 22-1 → 22-2 → 23-1 → 23-2 → 25-1 → 25-2 → 25-3 →（前端并行）21-3, 22-3, 23-3, 25-4 → lib.rs 注册 → 构建验证

---

## 6. 依赖包

**无需新增依赖。**
- 前端已有 echarts, xlsx, @dnd-kit
- 后端已有 zip, walkdir, rusqlite, nanoid

---

## 7. 共享知识

1. **camelCase 映射**：所有 Rust struct 必须有 `#[serde(rename_all = "camelCase")]`
2. **DbPool 使用**：所有 command 通过 `state: tauri::State<DbPool>` 获取连接，不直接使用 Connection
3. **错误处理**：使用 `map_err` + `log::error!` 模式，返回 `String` 错误
4. **日期格式**：`chrono::Local::now().to_rfc3339()` 存储 ISO 8601
5. **前端类型**：新增 TypeScript 类型必须同步到 types/index.ts，api.ts 引用这些类型
6. **空值安全**：Rust query_map 中每列使用 `row.get(0)?` 模式

---

## 8. 待明确事项

1. `Jobs.tsx` 中新建职位的表单是在 `Jobs.tsx` 内联还是独立组件？需要查看现有代码确认 JobForm 的位置。
2. `candidateStore` 的 filter state 结构需要确认，用于导出「当前筛选结果」范围。
