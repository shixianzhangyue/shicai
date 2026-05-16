# TalentVault · 本地招聘管理系统 · 开发规格书（修订版）

> **项目代号：** TalentVault
> **版本：** v4.1 Revised
> **定位：** Windows 端本地运行的个人招聘管理工具，以人才库管理为核心，猎头工作流驱动
> **技术栈：** Tauri 2 + React 18 + TypeScript + SQLite
> **功能范围：** 5 模块 · 28 功能点 · 3 阶段交付

---

## 一、技术栈与版本

| 层级 | 选型 | 说明 |
|---|---|---|
| 桌面框架 | Tauri 2 | Rust 后端 + 系统 WebView，包体 ~5MB |
| 前端框架 | React 18 + TypeScript | 函数组件 + Hooks |
| UI 组件库 | shadcn/ui | 基于 Radix UI，代码复制到项目内，深度可控 |
| 样式 | Tailwind CSS 3 | 原子化 CSS |
| 状态管理 | Zustand | 轻量，无 Provider 包裹 |
| 数据库 | SQLite (rusqlite) | Tauri 插件 @tauri-apps/plugin-sql |
| 数据库连接池 | r2d2_sqlite | SQLite 并发安全，带连接池管理 |
| 数据库迁移 | refinery | 版本化迁移管理，支持 up/down 脚本 |
| 文件操作 | Tauri fs API | @tauri-apps/plugin-fs |
| 对话框 | Tauri dialog API | @tauri-apps/plugin-dialog |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable | 看板拖拽 |
| 日历 | @fullcalendar/react | 面试日历视图 |
| 图表 | ECharts (echarts-for-react) | 仪表盘和报表 |
| PDF 预览 | react-pdf（主）/ @react-pdf-viewer/core（备选）| 简历预览；如遇 WebView 兼容性问题，降级为调用系统默认阅读器 |
| Excel 处理 | xlsx (SheetJS) | 批量导入 + 数据导出 |
| 文件压缩 | zip (Rust crate) | 备份打包（Rust 端异步执行，替代前端 JSZip）|
| 输入校验 | validator (Rust crate) | 统一输入校验，derive Validate |
| 日志 | log + simplelog (Rust crate) | 文件日志输出到 app data_dir/logs/ |
| ID 生成 | nanoid | 短 ID |
| 构建工具 | Vite 5 | 前端构建 |
| 包管理 | pnpm | 快速、节省磁盘 |

**新增依赖说明：**
- `r2d2_sqlite`：解决 SQLite 单连接并发写入导致的 `database is locked` 问题
- `refinery`：提供版本化的数据库迁移机制，替代一次性 schema.sql
- `zip` + `walkdir`：Rust 端异步打包备份文件，避免前端 JSZip 阻塞主线程
- `validator` + `serde_valid`：统一 Tauri command 输入校验，避免参数校验分散
- `log` + `simplelog`：持久化文件日志，至少记录 ERROR 级别，替代仅 toast 通知
- `@react-pdf-viewer/core`（可选）：react-pdf 在 WebView2 中出现 blob: URL 兼容性问题时作为备选方案

---

## 二、目录结构

```
talent-vault/
├── src-tauri/                          # Tauri Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json                 # Tauri 配置
│   ├── build.rs
│   ├── icons/
│   └── src/
│       ├── main.rs                     # Rust 入口
│       ├── lib.rs                      # Tauri 插件注册
│       ├── logger.rs                   # 【新增】日志初始化配置
│       ├── validate.rs                 # 【新增】统一输入校验层
│       ├── db/
│       │   ├── mod.rs                  # 数据库初始化 + 连接池
│       │   ├── pool.rs                 # 【新增】r2d2_sqlite 连接池封装
│       │   ├── migrations/             # 【变更】版本化迁移脚本目录
│       │   │   ├── V1__init.sql        # 初始建表（原 schema.sql 内容）
│       │   │   ├── V2__soft_delete.sql # 新增 deleted_at 字段
│       │   │   └── V3__schema_version.sql # _schema_version 元表
│       │   └── migrations.rs           # 【变更】refinery 迁移 runner
│       └── commands/                   # Tauri commands（后端 API）
│           ├── mod.rs
│           ├── jobs.rs                 # 职位相关（含软删除）
│           ├── candidates.rs           # 候选人相关（含软删除 + 缓存索引接口）
│           ├── pipeline.rs             # 流程相关（含防抖说明）
│           ├── talent_pool.rs          # 人才库相关
│           ├── backup.rs               # 【变更】备份恢复（Rust 端 zip + .bak 回滚）
│           └── export.rs               # 【新增】数据导出（含字段配置）
├── src/                                # React 前端
│   ├── main.tsx                        # 渲染进程入口
│   ├── App.tsx                         # 根组件 + 路由
│   ├── components/
│   │   ├── ui/                         # shadcn/ui 组件（copy 到项目内）
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx             # 左侧导航
│   │   │   └── PageLayout.tsx          # 页面容器
│   │   ├── kanban/
│   │   │   ├── Board.tsx               # 看板主体（含拖拽防抖）
│   │   │   ├── Column.tsx              # 看板列
│   │   │   └── Card.tsx                # 候选人卡片
│   │   ├── candidates/
│   │   │   ├── CandidateForm.tsx       # 候选人表单
│   │   │   ├── CandidateList.tsx       # 候选人列表
│   │   │   ├── CandidateDetail.tsx     # 候选人详情
│   │   │   ├── ResumePreview.tsx       # 简历预览（含 WebView 兼容降级）
│   │   │   ├── NoteArea.tsx            # 跟进记录
│   │   │   ├── RelationArea.tsx        # 候选人关系
│   │   │   ├── QuickRecord.tsx         # 快速记录浮层（含本地缓存索引）
│   │   │   └── ImportDialog.tsx        # 批量导入弹窗
│   │   ├── jobs/
│   │   │   ├── JobForm.tsx
│   │   │   ├── JobList.tsx
│   │   │   ├── JobDetail.tsx
│   │   │   └── StageConfig.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   └── StatCard.tsx
│   │   └── settings/
│   │       ├── BackupRestore.tsx       # 【变更】适配 Rust 端备份恢复
│   │       └── ExportConfig.tsx        # 【新增】导出字段勾选 + 排序配置
│   ├── stores/
│   │   ├── jobStore.ts
│   │   ├── candidateStore.ts           # 【变更】增加 name→id 缓存 Map
│   │   ├── pipelineStore.ts
│   │   ├── talentPoolStore.ts
│   │   └── uiStore.ts
│   ├── hooks/
│   │   ├── useJobs.ts
│   │   ├── useCandidates.ts
│   │   ├── usePipeline.ts
│   │   ├── useSearch.ts
│   │   └── useDebounce.ts              # 【新增】通用防抖 hook
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── api.ts                      # Tauri invoke 封装
│   │   └── constants.ts
│   └── types/
│       └── index.ts                    # 【变更】增加 deletedAt、导出配置等类型
├── res/                                # 简历文件存储（Tauri app data 目录）
│   └── candidates/
│       └── {candidate_id}/
├── data/
│   └── talent.db                       # SQLite 数据库文件
├── logs/                               # 【新增】日志文件目录
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── components.json                     # shadcn/ui 配置
```

**目录结构变更说明：**
1. `src-tauri/src/logger.rs`：新增，配置 simplelog 将 ERROR 及以上级别日志写入 `logs/talent-vault-{date}.log`
2. `src-tauri/src/validate.rs`：新增，统一定义 `CreateJobInput`、`CreateCandidateInput` 等 struct，derive `Validate`
3. `src-tauri/src/db/pool.rs`：新增，封装 `DbPool` 类型（`r2d2::Pool<SqliteConnectionManager>`），所有 commands 通过 `state::get::<DbPool>()` 获取连接
4. `src-tauri/src/db/migrations/`：由单文件 `migrations.rs + schema.sql` 变更为 `migrations/` 目录，每个版本一个 `.sql` 文件，文件名格式 `V{version}__{description}.sql`
5. `src-tauri/src/commands/export.rs`：新增，分离导出逻辑，支持动态字段和排序配置
6. `src-tauri/src/commands/backup.rs`：重写，使用 `zip` crate 在 Rust 端异步打包，恢复前自动创建 `.bak` 回滚文件
7. `src/hooks/useDebounce.ts`：新增，通用防抖 hook，用于看板拖拽、批量操作等高频触发场景
8. `src/components/settings/ExportConfig.tsx`：新增，导出弹窗中的字段勾选器和拖拽排序面板

---

## 三、数据库 Schema

数据库文件位于 Tauri app data 目录下 `data/talent.db`。
启动时通过 `refinery` 自动执行迁移，按版本号顺序递增。
Rust 后端使用 `r2d2_sqlite` 连接池管理数据库连接，所有写操作通过连接池串行化，避免 `database is locked`。

```sql
-- 数据库迁移版本元表（由 refinery 自动创建，但需在 V3 中显式确认）
CREATE TABLE IF NOT EXISTS _schema_version (
  version INTEGER PRIMARY KEY,
  applied_on TEXT NOT NULL,
  checksum TEXT NOT NULL
);

-- 职位表
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT,
  salary_min REAL,
  salary_max REAL,
  description TEXT,
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'draft',    -- draft | open | paused | closed
  tags TEXT DEFAULT '[]',                  -- JSON array of tag ids
  deleted_at TEXT,                         -- 【新增】软删除标记，NULL 表示未删除
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at);

-- 候选人表
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  current_company TEXT,
  current_position TEXT,
  education TEXT,                          -- 高中 | 大专 | 本科 | 硕士 | 博士
  years_exp INTEGER,
  source TEXT DEFAULT 'manual',            -- manual | import | referral
  tags TEXT DEFAULT '[]',                  -- JSON array of tag ids
  deleted_at TEXT,                         -- 【新增】软删除标记，NULL 表示未删除
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_candidates_deleted_at ON candidates(deleted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(name);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);

-- 简历文件表
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,                 -- pdf | docx | jpg | png
  parsed_data TEXT,                        -- JSON, AI 解析结果
  uploaded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON resumes(candidate_id);

-- 流程阶段定义表
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_default INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stages_job ON pipeline_stages(job_id);

-- 候选人-职位关联表（核心枢纽）
CREATE TABLE IF NOT EXISTS candidate_pipeline (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  current_stage_id TEXT REFERENCES pipeline_stages(id),
  status TEXT NOT NULL DEFAULT 'active',   -- active | rejected | pooled
  entered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pipeline_candidate ON candidate_pipeline(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_job ON candidate_pipeline(job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON candidate_pipeline(current_stage_id);

-- 跟进记录表（原"备注"，猎头升级版）
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  content TEXT NOT NULL,
  follow_type TEXT DEFAULT 'other',        -- phone | wechat | meeting | email | other
  result TEXT,                             -- positive | neutral | declined | accepted | rejected
  next_follow_date TEXT,                   -- 下次跟进日期
  related_job_id TEXT REFERENCES jobs(id), -- 关联职位
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_followups_candidate ON follow_ups(candidate_id);
CREATE INDEX IF NOT EXISTS idx_followups_next_date ON follow_ups(next_follow_date);

-- 候选人关系表
CREATE TABLE IF NOT EXISTS candidate_relations (
  id TEXT PRIMARY KEY,
  candidate_id_a TEXT NOT NULL REFERENCES candidates(id),
  candidate_id_b TEXT NOT NULL REFERENCES candidates(id),
  relation_type TEXT NOT NULL,             -- colleague | superior | referral | friend | classmate | other
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_relations_a ON candidate_relations(candidate_id_a);
CREATE INDEX IF NOT EXISTS idx_relations_b ON candidate_relations(candidate_id_b);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3b82f6',
  created_at TEXT NOT NULL
);

-- 职位模板表
CREATE TABLE IF NOT EXISTS job_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,                   -- JSON
  created_at TEXT NOT NULL
);

-- 统计缓存表（可选，用于加速仪表盘）
CREATE TABLE IF NOT EXISTS stats_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 审计日志表（【新增】，记录核心实体的删除和恢复操作）
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,                -- jobs | candidates
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,                    -- soft_delete | restore | hard_delete
  old_data TEXT,                           -- JSON，删除前的完整记录
  performed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_logs(table_name, record_id);
```

**Schema 变更说明：**
1. `jobs` 和 `candidates` 表新增 `deleted_at TEXT` 字段，实现软删除。所有 `ON DELETE CASCADE` 外键约束移除（软删除不触发级联），改为应用层控制关联数据的可见性。
2. 新增 `_schema_version` 元表（由 refinery 框架自动维护），每次数据库结构变更必须新增一个带 version number 的迁移文件，禁止直接修改已发布的迁移脚本。
3. 新增 `audit_logs` 审计日志表，记录核心实体的删除和恢复操作，至少保留删除前的完整 JSON 快照，便于误删追溯。
4. 新增 `idx_candidates_name` 和 `idx_candidates_phone` 索引，加速快速记录时的模糊搜索和手机号匹配。
5. `resumes`、`pipeline_stages`、`candidate_pipeline`、`follow_ups`、`candidate_relations` 的外键约束不再使用 `ON DELETE CASCADE`，避免软删除时意外级联删除关联数据。

---

## 四、共享类型定义

```typescript
// src/types/index.ts

export type JobStatus = 'draft' | 'open' | 'paused' | 'closed';
export type PipelineStatus = 'active' | 'rejected' | 'pooled';
export type EducationLevel = '高中' | '大专' | '本科' | '硕士' | '博士';
export type CandidateSource = 'manual' | 'import' | 'referral';
export type ResumeFileType = 'pdf' | 'docx' | 'jpg' | 'png';
export type FollowType = 'phone' | 'wechat' | 'meeting' | 'email' | 'other';
export type FollowResult = 'positive' | 'neutral' | 'declined' | 'accepted' | 'rejected';
export type RelationType = 'colleague' | 'superior' | 'referral' | 'friend' | 'classmate' | 'other';

// 【新增】导出字段配置
export type ExportableField =
  | 'name' | 'phone' | 'email' | 'currentCompany' | 'currentPosition'
  | 'education' | 'yearsExp' | 'source' | 'tags' | 'createdAt';

export interface ExportConfig {
  fields: ExportableField[];              -- 勾选的字段列表
  fieldOrder: ExportableField[];          -- 字段输出顺序（支持拖拽排序）
  format: 'xlsx' | 'csv';
  scope: 'all' | 'filtered' | 'job';
  jobId?: string;
}

export interface Job {
  id: string;
  title: string;
  department: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string | null;
  requirements: string | null;
  status: JobStatus;
  tags: string[];
  deletedAt: string | null;               -- 【新增】软删除标记
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  currentCompany: string | null;
  currentPosition: string | null;
  education: EducationLevel | null;
  yearsExp: number | null;
  source: CandidateSource;
  tags: string[];
  deletedAt: string | null;               -- 【新增】软删除标记
  createdAt: string;
  updatedAt: string;
}

// 【新增】快速记录搜索缓存项
export interface CandidateSearchIndex {
  id: string;
  name: string;
  phoneLast4: string | null;              -- 手机号后4位，用于快速定位
}

export interface Resume {
  id: string;
  candidateId: string;
  filePath: string;
  fileName: string;
  fileType: ResumeFileType;
  parsedData: Record<string, unknown> | null;
  uploadedAt: string;
}

export interface PipelineStage {
  id: string;
  jobId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
}

export interface CandidatePipeline {
  id: string;
  candidateId: string;
  jobId: string;
  currentStageId: string | null;
  status: PipelineStatus;
  enteredAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  candidateId: string;
  content: string;
  followType: FollowType;
  result: FollowResult | null;
  nextFollowDate: string | null;
  relatedJobId: string | null;
  createdAt: string;
}

export interface CandidateRelation {
  id: string;
  candidateIdA: string;
  candidateIdB: string;
  relationType: RelationType;
  note: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface JobTemplate {
  id: string;
  name: string;
  content: Partial<Job>;
  createdAt: string;
}

export interface ImportRow {
  name: string;
  phone?: string;
  email?: string;
  currentCompany?: string;
  currentPosition?: string;
  education?: string;
  yearsExp?: number;
  source?: string;
}

export interface ImportResult {
  success: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface OverviewStats {
  openJobs: number;
  totalCandidates: number;
  talentPoolSize: number;
  todayFollowUps: number;
}

export interface FunnelData {
  stage: string;
  count: number;
}

export interface RelationWithCandidate {
  relation: CandidateRelation;
  candidate: Candidate;
}

// 【新增】审计日志类型
export interface AuditLog {
  id: string;
  tableName: 'jobs' | 'candidates';
  recordId: string;
  action: 'soft_delete' | 'restore' | 'hard_delete';
  oldData: Record<string, unknown> | null;
  performedAt: string;
}
```

**类型定义变更说明：**
1. `Job` 和 `Candidate` 接口新增 `deletedAt: string | null` 字段，前端列表默认过滤 `deletedAt === null` 的记录。
2. 新增 `ExportConfig` 和 `ExportableField` 类型，用于支持导出字段的勾选和排序。
3. 新增 `CandidateSearchIndex` 类型，用于快速记录的本地缓存索引。
4. 新增 `AuditLog` 类型，用于审计日志展示（可选）。

---

## 五、Tauri Commands（后端 API）

Tauri 使用 Rust commands 替代 Electron IPC。
前端通过 `invoke('command_name', { args })` 调用。
所有 commands 在 `src-tauri/src/commands/` 中定义。
所有 commands 的复杂输入参数必须使用 `validate.rs` 中定义的 Input struct，并 derive `Validate` 进行统一校验。
所有数据库操作通过 `DbPool` 获取连接，禁止直接使用裸 `Connection`。

### 5.1 统一输入校验层

```rust
// src-tauri/src/validate.rs

use validator::{Validate, ValidationError};
use serde::{Deserialize, Serialize};

#[derive(Debug, Validate, Deserialize)]
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
    #[validate(regex(path = "*crate::constants::JOB_STATUS_RE", message = "无效的状态值"))]
    pub status: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Validate, Deserialize)]
pub struct CreateCandidateInput {
    #[validate(length(min = 1, max = 100, message = "姓名不能为空且不超过100字符"))]
    pub name: String,
    #[validate(phone(message = "手机号格式不正确"))]
    pub phone: Option<String>,
    #[validate(email(message = "邮箱格式不正确"))]
    pub email: Option<String>,
    pub current_company: Option<String>,
    pub current_position: Option<String>,
    pub education: Option<String>,
    #[validate(range(min = 0, max = 50, message = "工作年限应在 0-50 之间"))]
    pub years_exp: Option<i32>,
    pub source: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Validate, Deserialize)]
pub struct ExportDataInput {
    #[validate(length(min = 1, message = "至少选择一个导出字段"))]
    pub fields: Vec<String>,
    pub field_order: Vec<String>,
    #[validate(regex(path = "*crate::constants::EXPORT_FORMAT_RE", message = "仅支持 xlsx 或 csv"))]
    pub format: String,
    pub scope: String,
    pub job_id: Option<String>,
}

// 统一校验入口
pub fn validate_input<T: Validate>(input: &T) -> Result<(), String> {
    input.validate().map_err(|e| e.to_string())
}
```

**校验层说明：**
1. 所有新增/更新的 command 入参必须定义对应的 Input struct，在 `validate.rs` 中集中管理。
2. 使用 `validator` crate 的 `Validate` derive 宏，支持长度、范围、正则、邮箱、手机号等常用校验规则。
3. Command 函数第一行调用 `validate_input(&input)?`，校验失败直接返回 `Err` 给前端。
4. 禁止在 command 函数内部写分散的参数校验逻辑。

### 5.2 连接池与日志初始化

```rust
// src-tauri/src/db/pool.rs

use r2d2_sqlite::SqliteConnectionManager;
use r2d2::Pool;
use std::path::PathBuf;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn create_pool(db_path: PathBuf) -> Result<DbPool, String> {
    let manager = SqliteConnectionManager::file(db_path);
    Pool::builder()
        .max_size(1)  -- SQLite 单文件写入串行化，max_size=1 避免 locked
        .build(manager)
        .map_err(|e| e.to_string())
}

// src-tauri/src/logger.rs

use simplelog::*;
use std::fs;
use std::path::PathBuf;

pub fn init_logger(log_dir: PathBuf) -> Result<(), String> {
    fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    let log_file = log_dir.join(format!("talent-vault-{}.log", chrono::Local::now().format("%Y-%m-%d")));
    let file_config = ConfigBuilder::new()
        .set_time_format_rfc3339()
        .build();
    CombinedLogger::init(vec![
        TermLogger::new(
            LevelFilter::Warn,
            Config::default(),
            TerminalMode::Mixed,
            ColorChoice::Auto,
        ),
        WriteLogger::new(
            LevelFilter::Error,
            file_config,
            fs::File::create(log_file).map_err(|e| e.to_string())?,
        ),
    ]).map_err(|e| e.to_string())?;
    Ok(())
}
```

### 5.3 职位 commands

```rust
// src-tauri/src/commands/jobs.rs

#[tauri::command]
fn list_jobs(
    state: tauri::State<DbPool>,
    status: Option<String>,
    keyword: Option<String>,
    include_deleted: Option<bool>   -- 【新增】默认 false，管理后台可传 true
) -> Result<Vec<Job>, String>

#[tauri::command]
fn get_job(state: tauri::State<DbPool>, id: String) -> Result<Option<Job>, String>

#[tauri::command]
fn create_job(
    state: tauri::State<DbPool>,
    input: CreateJobInput              -- 【变更】改为 struct，自动校验
) -> Result<Job, String>

#[tauri::command]
fn update_job(
    state: tauri::State<DbPool>,
    id: String,
    input: UpdateJobInput              -- 【变更】改为 struct，自动校验
) -> Result<Job, String>

#[tauri::command]
fn delete_job(state: tauri::State<DbPool>, id: String) -> Result<(), String>
-- 【变更】软删除：UPDATE jobs SET deleted_at = ? WHERE id = ?
-- 同步写入 audit_logs 表，保存删除前快照

#[tauri::command]
fn restore_job(state: tauri::State<DbPool>, id: String) -> Result<Job, String>
-- 【新增】恢复软删除记录，清空 deleted_at

#[tauri::command]
fn hard_delete_job(state: tauri::State<DbPool>, id: String) -> Result<(), String>
-- 【新增】彻底删除（仅在管理场景使用），需二次确认

#[tauri::command]
fn duplicate_job(state: tauri::State<DbPool>, id: String) -> Result<Job, String>

#[tauri::command]
fn list_job_templates(state: tauri::State<DbPool>) -> Result<Vec<JobTemplate>, String>

#[tauri::command]
fn create_job_template(state: tauri::State<DbPool>, name: String, content: String) -> Result<JobTemplate, String>

#[tauri::command]
fn delete_job_template(state: tauri::State<DbPool>, id: String) -> Result<(), String>
```

**职位 commands 变更说明：**
1. 所有函数签名增加 `state: tauri::State<DbPool>`，通过连接池获取连接。
2. `create_job` / `update_job` 入参改为 `CreateJobInput` / `UpdateJobInput` struct，由 `validator` 自动校验。
3. `delete_job` 改为软删除（设置 `deleted_at = now()`），并同步写入 `audit_logs` 表。
4. 新增 `restore_job` 和 `hard_delete_job`，分别用于恢复和彻底删除。
5. `list_jobs` 默认排除已软删除记录（`WHERE deleted_at IS NULL`），可选参数 `include_deleted` 用于管理场景。

### 5.4 候选人 commands

```rust
// src-tauri/src/commands/candidates.rs

#[tauri::command]
fn list_candidates(
    state: tauri::State<DbPool>,
    keyword: Option<String>,
    tags: Option<Vec<String>>,
    education: Option<String>,
    min_exp: Option<i32>,
    max_exp: Option<i32>,
    source: Option<String>,
    include_deleted: Option<bool>
) -> Result<Vec<Candidate>, String>

#[tauri::command]
fn get_candidate(state: tauri::State<DbPool>, id: String) -> Result<Option<Candidate>, String>

#[tauri::command]
fn create_candidate(
    state: tauri::State<DbPool>,
    input: CreateCandidateInput          -- 【变更】改为 struct，自动校验
) -> Result<Candidate, String>

#[tauri::command]
fn update_candidate(
    state: tauri::State<DbPool>,
    id: String,
    input: UpdateCandidateInput          -- 【变更】改为 struct，自动校验
) -> Result<Candidate, String>

#[tauri::command]
fn delete_candidate(state: tauri::State<DbPool>, id: String) -> Result<(), String>
-- 【变更】软删除，同步写入 audit_logs

#[tauri::command]
fn restore_candidate(state: tauri::State<DbPool>, id: String) -> Result<Candidate, String>
-- 【新增】恢复软删除

#[tauri::command]
fn check_duplicate(state: tauri::State<DbPool>, phone: Option<String>, email: Option<String>) -> Result<Vec<Candidate>, String>

#[tauri::command]
fn import_candidates(state: tauri::State<DbPool>, rows: Vec<ImportRow>) -> Result<ImportResult, String>

#[tauri::command]
fn get_candidate_search_index(state: tauri::State<DbPool>) -> Result<Vec<CandidateSearchIndex>, String>
-- 【新增】返回所有候选人的 id + name + phone_last4，供前端快速记录缓存
```

**候选人 commands 变更说明：**
1. 同职位 commands，增加连接池、软删除、审计日志、统一校验。
2. 新增 `get_candidate_search_index`，一次性返回轻量化的搜索索引（id, name, phone_last4），前端存入 Zustand store 避免每次快速记录都查库。
3. `check_duplicate` 支持按手机号后 4 位模糊匹配（输入 4 位数字时走 `LIKE '%{last4}'`）。

### 5.5 流程 commands

```rust
// src-tauri/src/commands/pipeline.rs

#[tauri::command]
fn get_stages_by_job(state: tauri::State<DbPool>, job_id: String) -> Result<Vec<PipelineStage>, String>

#[tauri::command]
fn create_stage(state: tauri::State<DbPool>, job_id: String, name: String, sort_order: i32) -> Result<PipelineStage, String>

#[tauri::command]
fn update_stage(state: tauri::State<DbPool>, id: String, name: Option<String>, sort_order: Option<i32>) -> Result<PipelineStage>, String>

#[tauri::command]
fn delete_stage(state: tauri::State<DbPool>, id: String) -> Result<(), String>

#[tauri::command]
fn reorder_stages(state: tauri::State<DbPool>, job_id: String, stage_ids: Vec<String>) -> Result<(), String>

#[tauri::command]
fn init_default_stages(state: tauri::State<DbPool>, job_id: String) -> Result<Vec<PipelineStage>, String>

#[tauri::command]
fn get_pipeline_by_job(state: tauri::State<DbPool>, job_id: String) -> Result<Vec<PipelineEntry>, String>

#[tauri::command]
fn add_to_job(state: tauri::State<DbPool>, candidate_id: String, job_id: String) -> Result<CandidatePipeline, String>

#[tauri::command]
fn move_to_stage(state: tauri::State<DbPool>, pipeline_id: String, stage_id: String) -> Result<CandidatePipeline, String>

#[tauri::command]
fn reject_candidate(state: tauri::State<DbPool>, pipeline_id: String) -> Result<CandidatePipeline, String>

#[tauri::command]
fn pool_candidate(state: tauri::State<DbPool>, pipeline_id: String) -> Result<CandidatePipeline, String>

#[tauri::command]
fn batch_move(state: tauri::State<DbPool>, pipeline_ids: Vec<String>, stage_id: String) -> Result<(), String>

#[tauri::command]
fn batch_reject(state: tauri::State<DbPool>, pipeline_ids: Vec<String>) -> Result<(), String>
```

**流程 commands 变更说明：**
1. 所有函数增加 `state: tauri::State<DbPool>`。
2. `move_to_stage` 和 `batch_move` 在前端调用前必须经过 300ms 防抖，避免看板拖拽过程中频繁触发写操作（详见 6.4 看板视图规格）。

### 5.6 人才库 commands

```rust
// src-tauri/src/commands/talent_pool.rs

#[tauri::command]
fn list_talent_pool(
    state: tauri::State<DbPool>,
    keyword: Option<String>,
    tags: Option<Vec<String>>,
    source: Option<String>,
    original_job_id: Option<String>
) -> Result<Vec<TalentEntry>, String>

#[tauri::command]
fn reactivate_candidate(state: tauri::State<DbPool>, candidate_id: String, job_id: String) -> Result<CandidatePipeline, String>

#[tauri::command]
fn list_follow_ups(state: tauri::State<DbPool>, candidate_id: String) -> Result<Vec<FollowUp>, String>

#[tauri::command]
fn create_follow_up(state: tauri::State<DbPool>, candidate_id: String, content: String, follow_type: String, result: Option<String>, next_follow_date: Option<String>, related_job_id: Option<String>) -> Result<FollowUp, String>

#[tauri::command]
fn delete_follow_up(state: tauri::State<DbPool>, id: String) -> Result<(), String>

#[tauri::command]
fn get_today_follow_ups(state: tauri::State<DbPool>) -> Result<Vec<FollowUpWithCandidate>, String>

#[tauri::command]
fn list_relations(state: tauri::State<DbPool>, candidate_id: String) -> Result<Vec<RelationWithCandidate>, String>

#[tauri::command]
fn create_relation(state: tauri::State<DbPool>, candidate_id_a: String, candidate_id_b: String, relation_type: String, note: Option<String>) -> Result<CandidateRelation, String>

#[tauri::command]
fn delete_relation(state: tauri::State<DbPool>, id: String) -> Result<(), String>

#[tauri::command]
fn get_overview_stats(state: tauri::State<DbPool>) -> Result<OverviewStats, String>

#[tauri::command]
fn get_funnel_data(state: tauri::State<DbPool>, job_id: Option<String>) -> Result<Vec<FunnelData>, String>
```

### 5.7 导出 commands（【新增/变更】）

```rust
// src-tauri/src/commands/export.rs

#[tauri::command]
fn export_data(
    state: tauri::State<DbPool>,
    input: ExportDataInput                 -- 使用 validate.rs 中的 ExportDataInput
) -> Result<String, String>
-- 根据 input.fields 和 input.field_order 动态构建查询和 Excel/CSV 输出
-- 字段顺序严格按 field_order 排列

#[tauri::command]
fn get_exportable_fields() -> Result<Vec<{ key: String, label: String }>, String>
-- 【新增】返回所有可导出字段的元数据（key + 中文标签），供前端勾选器使用
```

### 5.8 备份 commands（【变更】）

```rust
// src-tauri/src/commands/backup.rs

use zip::write::FileOptions;
use walkdir::WalkDir;

#[tauri::command]
async fn export_backup(
    app_handle: tauri::AppHandle,
    output_path: String
) -> Result<String, String>
-- 【变更】在 Rust 端异步执行：
--   1. 获取 app data_dir 路径
--   2. 使用 zip crate 将 data/talent.db + res/ 目录打包
--   3. 写入 output_path
--   4. 返回打包后的文件路径

#[tauri::command]
async fn import_backup(
    app_handle: tauri::AppHandle,
    zip_path: String
) -> Result<(), String>
-- 【变更】安全恢复流程：
--   1. 校验 zip 文件格式（必须包含 talent.db）
--   2. 将当前 data/talent.db 复制为 data/talent.db.bak（自动回滚点）
--   3. 将当前 res/ 目录复制为 res.bak/
--   4. 解压 zip 覆盖 data/talent.db 和 res/
--   5. 启动时若检测到 .bak 文件且存在异常，提示用户回滚
--   6. 恢复成功后删除 .bak（或保留最近 3 个）

#[tauri::command]
async fn rollback_backup(app_handle: tauri::AppHandle) -> Result<(), String>
-- 【新增】从 .bak 文件自动回滚，用于恢复失败后的应急

#[tauri::command]
fn upload_resume(state: tauri::State<DbPool>, candidate_id: String, source_path: String) -> Result<Resume, String>

#[tauri::command]
fn delete_resume_file(state: tauri::State<DbPool>, id: String) -> Result<(), String>

#[tauri::command]
fn list_tags(state: tauri::State<DbPool>) -> Result<Vec<Tag>, String>

#[tauri::command]
fn create_tag(state: tauri::State<DbPool>, name: String, color: Option<String>) -> Result<Tag>, String>

#[tauri::command]
fn update_tag(state: tauri::State<DbPool>, id: String, name: Option<String>, color: Option<String>) -> Result<Tag>, String>

#[tauri::command]
fn delete_tag(state: tauri::State<DbPool>, id: String) -> Result<(), String>
```

**备份 commands 变更说明：**
1. `export_backup` 和 `import_backup` 改为 `async fn`，在 Rust 端使用 `zip` crate 异步处理，避免前端 JSZip 阻塞主线程。
2. `import_backup` 强制实现「恢复前自动备份当前数据为 .bak」机制，形成自动回滚点。
3. 新增 `rollback_backup` 命令，在恢复异常时从 `.bak` 文件一键回滚。
4. 保留最近 3 个 `.bak` 文件，超出时自动清理最旧的。

### 5.9 前端调用封装

```typescript
// src/lib/api.ts
// 封装所有 Tauri invoke 调用，统一错误处理 + 日志上报

import { invoke } from '@tauri-apps/api/core';

function handleError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  -- 错误信息同时通过 toast 通知用户
  -- ERROR 级别日志已由 Rust 端 simplelog 自动记录到文件
  return msg;
}

export const api = {
  jobs: {
    list: (filters?: { status?: string; keyword?: string; includeDeleted?: boolean }) =>
      invoke<Job[]>('list_jobs', { ...filters }),
    get: (id: string) => invoke<Job | null>('get_job', { id }),
    create: (data: CreateJobInput) => invoke<Job>('create_job', { input: data }),
    update: (id: string, data: UpdateJobInput) => invoke<Job>('update_job', { id, input: data }),
    delete: (id: string) => invoke<void>('delete_job', { id }),
    restore: (id: string) => invoke<Job>('restore_job', { id }),
    duplicate: (id: string) => invoke<Job>('duplicate_job', { id }),
  },

  candidates: {
    list: (filters?: CandidateFilters & { includeDeleted?: boolean }) =>
      invoke<Candidate[]>('list_candidates', filters ?? {}),
    get: (id: string) => invoke<Candidate | null>('get_candidate', { id }),
    create: (data: CreateCandidateInput) => invoke<Candidate>('create_candidate', { input: data }),
    update: (id: string, data: UpdateCandidateInput) =>
      invoke<Candidate>('update_candidate', { id, input: data }),
    delete: (id: string) => invoke<void>('delete_candidate', { id }),
    restore: (id: string) => invoke<Candidate>('restore_candidate', { id }),
    checkDuplicate: (phone?: string, email?: string) =>
      invoke<Candidate[]>('check_duplicate', { phone, email }),
    import: (rows: ImportRow[]) => invoke<ImportResult>('import_candidates', { rows }),
    getSearchIndex: () => invoke<CandidateSearchIndex[]>('get_candidate_search_index'),
  },

  pipeline: {
    getStages: (jobId: string) => invoke<PipelineStage[]>('get_stages_by_job', { jobId }),
    createStage: (jobId: string, name: string, sortOrder: number) =>
      invoke<PipelineStage>('create_stage', { jobId, name, sortOrder }),
    updateStage: (id: string, data: { name?: string; sortOrder?: number }) =>
      invoke<PipelineStage>('update_stage', { id, ...data }),
    deleteStage: (id: string) => invoke<void>('delete_stage', { id }),
    reorderStages: (jobId: string, stageIds: string[]) =>
      invoke<void>('reorder_stages', { jobId, stageIds }),
    initDefaults: (jobId: string) => invoke<PipelineStage[]>('init_default_stages', { jobId }),
    getByJob: (jobId: string) => invoke<PipelineEntry[]>('get_pipeline_by_job', { jobId }),
    addToJob: (candidateId: string, jobId: string) =>
      invoke<CandidatePipeline>('add_to_job', { candidateId, jobId }),
    moveToStage: (pipelineId: string, stageId: string) =>
      invoke<CandidatePipeline>('move_to_stage', { pipelineId, stageId }),
    reject: (pipelineId: string) => invoke<CandidatePipeline>('reject_candidate', { pipelineId }),
    pool: (pipelineId: string) => invoke<CandidatePipeline>('pool_candidate', { pipelineId }),
    batchMove: (pipelineIds: string[], stageId: string) =>
      invoke<void>('batch_move', { pipelineIds, stageId }),
    batchReject: (pipelineIds: string[]) =>
      invoke<void>('batch_reject', { pipelineIds }),
  },

  talentPool: {
    list: (filters?: TalentPoolFilters) =>
      invoke<TalentEntry[]>('list_talent_pool', filters ?? {}),
    reactivate: (candidateId: string, jobId: string) =>
      invoke<CandidatePipeline>('reactivate_candidate', { candidateId, jobId }),
  },

  followUps: {
    list: (candidateId: string) => invoke<FollowUp[]>('list_follow_ups', { candidateId }),
    create: (data: CreateFollowUpInput) => invoke<FollowUp>('create_follow_up', data),
    delete: (id: string) => invoke<void>('delete_follow_up', { id }),
    getToday: () => invoke<FollowUpWithCandidate[]>('get_today_follow_ups'),
  },

  relations: {
    list: (candidateId: string) =>
      invoke<RelationWithCandidate[]>('list_relations', { candidateId }),
    create: (data: CreateRelationInput) =>
      invoke<CandidateRelation>('create_relation', data),
    delete: (id: string) => invoke<void>('delete_relation', { id }),
  },

  tags: {
    list: () => invoke<Tag[]>('list_tags'),
    create: (name: string, color?: string) => invoke<Tag>('create_tag', { name, color }),
    update: (id: string, data: { name?: string; color?: string }) =>
      invoke<Tag>('update_tag', { id, ...data }),
    delete: (id: string) => invoke<void>('delete_tag', { id }),
  },

  jobTemplates: {
    list: () => invoke<JobTemplate[]>('list_job_templates'),
    create: (name: string, content: string) =>
      invoke<JobTemplate>('create_job_template', { name, content }),
    delete: (id: string) => invoke<void>('delete_job_template', { id }),
  },

  stats: {
    overview: () => invoke<OverviewStats>('get_overview_stats'),
    funnel: (jobId?: string) => invoke<FunnelData[]>('get_funnel_data', { jobId }),
  },

  export: {
    export: (config: ExportConfig) => invoke<string>('export_data', { input: config }),
    getFields: () => invoke<{ key: string; label: string }[]>('get_exportable_fields'),
  },

  backup: {
    export: (outputPath: string) => invoke<string>('export_backup', { outputPath }),
    import: (zipPath: string) => invoke<void>('import_backup', { zipPath }),
    rollback: () => invoke<void>('rollback_backup'),
  },

  resume: {
    upload: (candidateId: string, sourcePath: string) =>
      invoke<Resume>('upload_resume', { candidateId, sourcePath }),
    delete: (id: string) => invoke<void>('delete_resume_file', { id }),
  },

  file: {
    openDialog: (filters?: { name: string; extensions: string[] }[]) =>
      invoke<string | null>('open_file_dialog', { filters }),
    showSaveDialog: (defaultName: string) =>
      invoke<string | null>('show_save_dialog', { defaultName }),
  },
};
```

---

## 六、页面与功能规格

### 6.1 全局布局

- 左侧固定导航栏，宽度 240px，收起时 64px（仅图标）
- 导航项（带图标）：
  - 📋 职位管理
  - 🗂️ 人才库
  - 🔄 招聘看板（入口在职位详情内）
  - 📊 仪表盘
  - ⚙️ 设置
- 导航底部显示今日待跟进数量徽标（红色气泡）
- 右侧为内容区，顶部有面包屑和页面标题
- 暗色主题
- 主色调：#3b82f6（蓝）
- 背景：#0f1117
- 卡片：#1a1d24
- 边框：#2a2d35
- 文字主色：#e2e8f0
- 文字次色：#94a3b8

### 6.2 职位管理（5 个功能）

**职位列表页 `/jobs`**
- 表格展示所有职位：标题、部门、薪资范围、状态徽标、候选人数量、创建时间
- 顶部筛选栏：状态筛选（全部/招聘中/暂停/已关闭）、关键词搜索
- 每行操作：编辑、复制、暂停/恢复、删除
- **【变更】删除操作改为软删除，点击后弹出二次确认对话框，说明影响范围：**
  - 「删除此职位后，关联的候选人流程记录将不再显示在该职位下，但候选人本身仍保留在人才库。是否继续？」
  - 确认后执行 `delete_job`，设置 `deleted_at`，并同步记录审计日志。
- 右上角按钮：新建职位、从模板新建
- 支持排序：按创建时间、按候选人数量

**职位创建/编辑表单 `/jobs/new` `/jobs/:id/edit`**
- 字段：标题*（必填）、部门、薪资范围（min-max）、职位描述（textarea）、任职要求（textarea）、标签（多选 TagPicker）
- 底部操作栏：保存为模板、保存草稿、发布
- 保存时自动创建 5 个默认流程阶段：简历筛选 → 初面 → 复面 → 终面 → 待入职
- **【新增】表单提交时前端校验必填项，后端通过 `CreateJobInput` / `UpdateJobInput` 二次校验，错误信息精确到字段。**

**职位详情页 `/jobs/:id`**
- 顶部：职位信息卡片（标题、部门、薪资、状态、标签）
- Tab 切换：看板视图 | 列表视图 | 流程配置
- 操作按钮：编辑、暂停/恢复、添加候选人

### 6.3 人才库（14 个功能）

**人才库主页 `/talent-pool`**
- 左侧筛选面板：来源、标签、学历、经验范围、原应聘职位
- 右侧候选人列表：姓名、当前公司、职位、标签、来源、最后跟进时间
- 顶部搜索栏：关键词（姓名/公司/职位模糊搜索）
- 右上角按钮：手动添加、批量导入

**候选人创建 `/candidates/new`**
- 基本信息表单：姓名*（必填）、手机、邮箱、当前公司、当前职位、学历（下拉）、工作年限、来源（下拉：手动/导入/推荐）、标签（多选）
- 简历上传区：支持拖拽上传 PDF/Word/图片
- 手机号/邮箱输入时实时查重，命中时弹出提示并显示已有记录
- **【新增】表单提交时前端校验手机号和邮箱格式，后端通过 `CreateCandidateInput` 二次校验。**

**候选人详情页 `/candidates/:id`**
- 左侧信息卡：姓名、联系方式、公司职位、学历经验、标签
- 右侧 Tab 切换：
  - **简历预览**：PDF 用 react-pdf 渲染，支持翻页
    - **【新增】兼容性处理：**
      - 启动时检测 react-pdf 是否正常加载 PDF.js Worker
      - 若检测到 WebView2 中 blob: URL 被拦截，自动降级为「调用系统默认 PDF 阅读器打开」
      - 备选方案：可切换为 `@react-pdf-viewer/core`（需额外安装）
    - Word/图片显示缩略图+下载
  - **跟进记录**：时间线倒序展示，支持新增/删除
  - **关系网络**：展示关联的其他候选人和关系类型
  - **应聘历史**：该候选人关联过哪些职位、各职位流程进展
- 操作按钮：编辑、删除、关联职位（加入某个职位的 Pipeline）
- **【变更】删除操作改为软删除，二次确认对话框说明：**「删除后该候选人将移入回收站，关联的跟进记录和关系网络仍保留。可在设置中恢复。」

**批量导入**
- 入口：人才库页面右上角「批量导入」按钮
- 流程：
  1. 选择 Excel/CSV 文件（用 @tauri-apps/plugin-dialog 打开文件选择器）
  2. 解析文件，预览前 10 行数据
  3. 字段映射：手动指定哪一列对应哪个字段（姓名*必须映射）
  4. 点击导入，后端逐行处理，查重跳过已存在的（按手机号+邮箱）
  5. 导入完成后显示结果：成功 N 条 / 跳过 N 条 / 失败 N 条
- 支持的字段：姓名、手机、邮箱、当前公司、当前职位、学历、经验年限、来源
- **【新增】导入行数据同样经过 `CreateCandidateInput` 校验，格式错误整行跳过并计入失败。**

**简历查重**
- 在创建候选人和批量导入时触发
- 按手机号精确匹配 + 按邮箱精确匹配
- **【新增】快速记录场景下支持手机号后 4 位模糊匹配（输入 4 位数字时自动触发）。**
- 命中时弹出提示，显示已有记录的基本信息
- 用户可选择：关联到已有记录 / 强制新建（改手机号或邮箱）

**简历预览**
- 在候选人详情页「简历预览」Tab
- PDF：使用 react-pdf 渲染，支持翻页
  - **【新增】WebView 兼容检测**：若 react-pdf 加载失败（PDF.js Worker blob: URL 被拦截），自动显示「在系统阅读器中打开」按钮，调用 Tauri shell API 打开本地文件。
  - 备选：`@react-pdf-viewer/core` 使用不同的 Worker 加载策略，在部分 WebView 环境中更稳定。
- Word/图片：显示缩略图 + 下载按钮（用系统默认应用打开）
- 无简历文件时显示上传入口

**跟进记录**
- 在候选人详情页「跟进记录」Tab
- 新增跟进表单：
  - 跟进内容*（必填，textarea）
  - 跟进类型（下拉：电话/微信/面谈/邮件/其他）
  - 跟进结果（下拉：意向积极/意向一般/暂不考虑/已接受/已拒绝）
  - 下次跟进日期（日期选择器，可选）
  - 关联职位（下拉选择，可选）
- 展示区：按时间倒序，每条显示：类型图标 + 内容 + 结果标签 + 创建时间
- 支持删除

**快速记录**
- 全局浮层，快捷键 `Ctrl+Shift+N` 唤起
- 浮层内容：
  - 候选人搜索框（输入姓名模糊搜索，下拉选择）
    - **【新增】搜索框使用本地缓存索引（Zustand store 中的 `nameMap` 和 `phoneLast4Map`）**，无需每次请求后端，响应 < 50ms。
    - 支持手机号后 4 位快速定位（输入 4 位数字时自动匹配）。
  - 一句话输入框（自动聚焦）
  - 提交按钮
- 提交后自动创建一条跟进记录（类型=其他，时间=当前）
- 10 秒内完成一次记录
- **【新增】应用启动时自动调用 `get_candidate_search_index` 加载索引到 `candidateStore.nameMap: Map<string, string>`（name → id）和 `phoneLast4Map: Map<string, string[]>`（后4位 → id 数组）。候选人增删改时同步更新 Map。**

**待跟进提醒**
- 侧边栏底部显示今日待跟进数量（红色气泡）
- 点击气泡展开待跟进列表：候选人姓名 + 下次跟进日期 + 关联职位
- 点击跳转到候选人详情页
- 查询条件：follow_ups 表中 next_follow_date <= 今天 且尚未完成的记录

**人才激活**
- 在人才库列表或候选人详情页点击「重新激活」
- 弹出职位选择器（只显示状态为 open 的职位）
- 选择目标职位后，创建新的 candidate_pipeline 记录
- 跳转到该职位的看板视图

**人才画像**
- 候选人详情页的增强版视图
- 聚合展示：
  - 基本信息卡片
  - 简历预览
  - 标签列表
  - 跟进记录时间线
  - 关系网络图
  - 应聘历史列表
- 所有信息在一个长页面内完整呈现，无需切换 Tab

**标签管理**
- 在设置页面管理
- 列表展示：标签名、颜色、引用次数
- 支持创建（名称 + 颜色选择器）、编辑、删除
- 删除标签时从所有引用该标签的候选人和职位的 tags JSON 数组中移除

### 6.4 招聘流程 Pipeline（6 个功能）

**自定义流程阶段**
- 在职位详情页「流程配置」Tab
- 列表展示当前职位的所有阶段，可拖拽排序
- 支持添加新阶段、重命名、删除（删除时提示该阶段下的候选人处理方式）
- 新建职位自动创建默认阶段：简历筛选 → 初面 → 复面 → 终面 → 待入职

**看板视图**
- 在职位详情页「看板」Tab
- 每个流程阶段为一列，列头显示阶段名 + 人数
- 候选人卡片显示：姓名、当前公司、当前职位、标签（最多 3 个）、进入时间
- 使用 @dnd-kit/core + @dnd-kit/sortable 实现跨列拖拽
- **【新增】拖拽防抖优化：**
  - 卡片拖拽释放后，前端先乐观更新 UI（立即显示到新列）
  - 实际调用 `move_to_stage` 延迟 300ms（debounce），若 300ms 内再次拖拽同一卡片，取消上次请求
  - 使用 `useDebounce.ts` hook：`const debouncedMove = useDebounce(moveToStage, 300)`
  - 批量拖拽（多选后一起移动）不走防抖，直接单次 `batch_move`
- 拖拽完成后立即调用 `move_to_stage` 更新数据库
- 卡片点击跳转到候选人详情
- 每列底部有「+ 添加候选人」按钮，弹出候选人搜索选择器

**列表视图**
- 在职位详情页「列表」Tab
- 表格展示该职位下所有候选人
- 列：姓名、当前阶段（彩色标签）、当前公司、经验、进入时间、操作
- 支持按阶段筛选
- 点击行跳转到候选人详情

**候选人状态流转**
- 看板：拖拽即流转（含防抖）
- 列表：每行操作列下拉菜单 → 推进到 [选择阶段] / 淘汰 / 待定
- 流转时自动更新 updated_at 字段

**淘汰与复活**
- 淘汰操作将 pipeline.status 改为 'rejected'
- 淘汰后候选人从当前职位看板消失，自动出现在人才库（标记来源为原职位）
- 复活：在人才库点击「重新激活」→ 选择目标职位 → 创建新 pipeline

**批量操作**
- 看板视图：Ctrl+Click 多选卡片，选中卡片高亮边框
- 列表视图：复选框多选
- 选中后底部出现浮动操作栏：
  - 批量推进到 [下拉选择阶段]
  - 批量淘汰
  - 已选 N 人 / 清除选择
- **【新增】批量操作按钮点击后显示二次确认弹窗，说明影响人数和具体操作，避免误触。**

### 6.5 仪表盘与数据（2 个功能）

**概览仪表盘 `/dashboard`**
- 4 个统计卡片（一行排列）：
  - 在招职位数（status=open 的 jobs，且 deleted_at IS NULL）
  - 候选人总数（deleted_at IS NULL）
  - 今日待跟进数
  - 人才库人数（pooled 状态的候选人）
- 柱状图：各职位的各阶段人数分布（堆叠柱状图）
- 今日待跟进列表（快捷入口）

**数据导出**
- 仪表盘右上角「导出」按钮
- **【变更】导出流程改为：**
  1. 点击「导出」弹出 `ExportConfigDialog`（`ExportConfig.tsx`）
  2. 弹窗左侧：字段勾选器（复选框列表，默认全选），显示字段中文标签
  3. 弹窗右侧：已选字段拖拽排序区（使用 @dnd-kit/sortable），决定输出列顺序
  4. 底部：格式选择（xlsx / csv）、范围选择（全部 / 当前筛选结果 / 某职位）
  5. 确认后调用 `export_data`，后端按 `field_order` 动态构建查询和文件
- 可选导出范围：全部候选人 / 当前筛选结果 / 某职位候选人
- 导出字段：姓名、手机、邮箱、公司、职位、学历、经验、来源、标签、创建时间
- 使用 SheetJS (xlsx) 生成文件（后端或前端生成，推荐后端生成后直接返回文件路径）
- 导出路径通过 Tauri save dialog 选择

### 6.6 系统设置 `/settings`（1 个功能）

**数据备份与恢复**
- 「导出备份」按钮：
  - 打开保存路径选择对话框
  - **【变更】将 data/talent.db + res/ 目录打包为 zip 的操作移至 Rust 端**
  - Rust 端使用 `zip` crate 异步打包，前端显示进度条（通过 Tauri 事件通道）
  - 文件命名：talent-vault-backup-{YYYY-MM-DD-HHmm}.zip
- 「导入恢复」按钮：
  - 打开文件选择对话框，选择 .zip 文件
  - 解压前弹出确认对话框：「恢复将覆盖当前所有数据，但系统会自动创建回滚备份（.bak）。确认继续？」
  - **【变更】Rust 端恢复流程：**
    1. 校验 zip 内必须包含 `talent.db`
    2. 将当前 `data/talent.db` 复制为 `data/talent.db.{timestamp}.bak`
    3. 将当前 `res/` 复制为 `res.{timestamp}.bak/`
    4. 解压 zip 覆盖
    5. 恢复完成后提示重启应用
    6. 若恢复后应用异常，设置页显示「回滚到恢复前状态」按钮（调用 `rollback_backup`）
- 备份文件内容结构：
  ```
  backup.zip
  ├── talent.db
  └── candidates/
      ├── {id1}/
      │   └── resume.pdf
      └── {id2}/
          └── resume.docx
  ```

**【新增】日志查看（可选）**
- 设置页面增加「查看日志」入口
- 显示最近 50 条 ERROR 级别日志（读取 `logs/talent-vault-{date}.log`）
- 提供「打开日志目录」按钮，方便用户反馈问题时提取日志

**【新增】回收站管理**
- 设置页面增加「回收站」入口
- 列表展示已软删除的职位和候选人（分页）
- 每行操作：恢复、彻底删除
- 彻底删除前二次确认，并说明「此操作不可撤销」

---

## 七、编码规范

### 通用规范
1. 所有 React 组件使用函数式 + Hooks
2. 所有异步操作必须 try-catch，错误通过 toast 通知用户
3. 前端禁止直接操作数据库，必须通过 `api` 封装层调用 Tauri commands
4. ID 使用 nanoid(10) 生成
5. 时间字段统一使用 ISO 8601 格式：`new Date().toISOString()`
6. JSON 字段（tags、scores、content 等）在数据库中存 TEXT，读取时 JSON.parse，写入时 JSON.stringify
7. **【新增】所有高频写操作（看板拖拽、批量操作、快速记录提交）必须经过防抖处理，最小防抖间隔 300ms**
8. **【新增】所有 Rust commands 的输入参数必须使用 validate.rs 中的 Input struct，禁止在函数内写分散校验逻辑**

### 命名规范
- React 组件文件：PascalCase → `CandidateForm.tsx`
- 工具函数：camelCase → `formatDate.ts`
- 数据库表：snake_case → `candidate_pipeline`
- TypeScript 接口：PascalCase → `CandidatePipeline`
- Tauri commands：snake_case → `list_candidates`
- CSS：Tailwind 原子类，不自定义 BEM

### 状态管理规范
- 每个业务模块一个 Zustand store
- Store 管理前端 UI 状态 + 缓存数据
- 数据变更通过 api 调用 Tauri commands，成功后更新 store
- Store 里不写业务逻辑，只做数据中转
- **【新增】`candidateStore` 必须维护 `nameMap: Map<string, string>` 和 `phoneLast4Map: Map<string, string[]>`，用于快速记录搜索。候选人增删改时同步更新 Map，确保索引与数据库一致。**

### Tauri Commands 规范
- 每个模块的 commands 放在独立文件中
- 所有 commands 必须返回 `Result<T, String>`
- 前端调用统一通过 `src/lib/api.ts` 封装
- 前端封装层统一处理错误，显示 toast
- **【新增】所有 commands 必须接收 `state: tauri::State<DbPool>`，通过连接池获取连接，禁止裸用 `Connection`**
- **【新增】涉及核心实体删除的 command（delete_job、delete_candidate）必须同步写入 audit_logs 表，保存操作前完整快照**

### 日志规范（【新增】）
- Rust 端使用 `log` + `simplelog` 记录日志
- 日志文件路径：`{app_data_dir}/logs/talent-vault-{YYYY-MM-DD}.log`
- 日志级别：终端输出 WARN 及以上，文件记录 ERROR 及以上
- 至少记录以下内容到 ERROR 级别：
  - 所有 Tauri command 返回 `Err` 的情况（在 api.ts 封装层统一上报）
  - 数据库连接池获取连接失败
  - 备份/恢复操作失败
  - 导入/导出操作失败
- 日志格式：`[YYYY-MM-DD HH:MM:SS] [ERROR] [module::function] message`

### 软删除规范（【新增】）
- 核心实体（jobs、candidates）禁止物理删除，统一使用 `deleted_at` 字段标记软删除
- 所有列表查询默认附加 `WHERE deleted_at IS NULL`
- 软删除时同步写入 `audit_logs`，保存 `old_data` JSON 快照
- 前端删除操作必须弹出二次确认对话框，说明影响范围
- 彻底删除（hard_delete）仅在「回收站」管理中提供，需再次确认

---

## 八、开发阶段与步骤

### Phase 1 · 核心闭环（预计 2-3 周）

**Step 1 - 项目初始化**
使用 `pnpm create tauri-app` 初始化项目。选择 React + TypeScript 模板。配置 Tailwind CSS。安装并配置 shadcn/ui（执行 `npx shadcn@latest init`）。安装 Zustand、react-router-dom、nanoid。
**【新增】安装 Rust 依赖：r2d2_sqlite、refinery、zip、walkdir、validator、log、simplelog。配置 logger.rs，确保应用启动时自动创建 logs/ 目录。**
验证：应用窗口正常显示，shadcn/ui 组件可正常渲染，logs/ 目录下有日志文件。

**Step 2 - 数据库初始化与迁移版本管理**
**【变更】原「一次性建表」改为版本化迁移机制：**
- 在 Rust 后端添加 rusqlite + r2d2_sqlite + refinery 依赖。
- 实现 `db/pool.rs`：创建 `DbPool`，max_size=1。
- 创建 `db/migrations/V1__init.sql`：包含所有初始 CREATE TABLE 语句（即原 schema.sql 内容）。
- 创建 `db/migrations/V2__soft_delete.sql`：为 jobs、candidates 增加 `deleted_at` 字段和索引，创建 `audit_logs` 表。
- 创建 `db/migrations/V3__schema_version.sql`：确认 `_schema_version` 元表结构（refinery 自动维护，此处显式声明）。
- 实现 `db/migrations.rs`：使用 `refinery::Runner` 按版本号顺序执行迁移，记录 checksum。
- 注册为 Tauri setup hook：启动时执行迁移，失败则记录 ERROR 日志并阻止应用启动。
- 实现第一个 command：`get_overview_stats` 用于验证数据库连接。
验证：启动应用后检查 data/talent.db 文件存在，`_schema_version` 表有 3 条记录，refinery 不再重复执行旧迁移。

**Step 3 - 全局布局 + 路由**
实现 Sidebar.tsx（左侧导航）+ PageLayout.tsx（内容区容器）。配置 react-router-dom 路由。导航项可点击切换页面。暗色主题。配置 Tailwind 暗色变量。
验证：点击导航项，右侧内容区正确切换。

**Step 4 - 标签管理**
实现 tags 相关的 Rust commands（list/create/update/delete）。前端实现设置页面中的标签管理 UI。标签选择器组件（可复用）。
验证：能创建、编辑、删除标签。

**Step 5 - 职位 CRUD（含软删除）**
**【变更】增加软删除和统一校验：**
- 实现 `validate.rs` 中的 `CreateJobInput`、`UpdateJobInput`，derive `Validate`。
- 实现 jobs 相关的 Rust commands，使用 `DbPool` 获取连接，`delete_job` 改为软删除并写 audit_logs。
- 前端实现职位列表页 + 创建/编辑表单 + 状态切换 + 复制 + 删除。
- 删除操作增加二次确认弹窗，说明影响范围。
- 集成标签选择器。
验证：能完整操作职位的增删改查；删除后 `deleted_at` 有值，audit_logs 有记录；列表不显示已删除职位。

**Step 6 - 职位模板**
实现 job_templates 相关 commands。前端在职位创建页面增加「保存为模板」和「从模板创建」。
验证：保存模板后能在新建时复用。

**Step 7 - 候选人 CRUD + 文件上传（含软删除）**
**【变更】同 Step 5，增加软删除和统一校验：**
- 实现 `validate.rs` 中的 `CreateCandidateInput`、`UpdateCandidateInput`。
- 实现 candidates 相关 Rust commands，含软删除和审计日志。
- 前端实现候选人列表页 + 创建表单。集成 Tauri 文件对话框 API 实现简历上传。文件存储到 res/candidates/{id}/ 目录。
- 表单提交时前端校验手机号和邮箱格式。
验证：能创建候选人并上传简历文件；删除逻辑同职位。

**Step 8 - 搜索与筛选**
候选人列表页增加多维筛选：关键词、标签、学历、经验范围、来源。后端 SQL 动态拼接查询条件。
**【新增】候选人列表查询默认附加 `WHERE deleted_at IS NULL`。**
验证：各筛选条件组合使用结果正确；已软删除候选人不出现。

**Step 9 - 流程阶段配置**
实现 pipeline_stages 相关 commands。前端在职位详情页实现流程配置 Tab。支持添加/删除/排序阶段。新建职位自动调用 init_default_stages。
验证：新建职位后有 5 个默认阶段，可自定义调整。

**Step 10 - 列表视图 + 状态流转**
实现 candidate_pipeline 相关 commands。前端在职位详情页实现列表 Tab。支持推进到指定阶段、淘汰。
验证：操作后 pipeline 状态正确变更。

**Step 11 - 看板视图（含防抖优化）**
**【变更】增加拖拽防抖和连接池支持：**
安装 @dnd-kit/core 和 @dnd-kit/sortable。实现看板 Tab：每个阶段一列，候选人卡片可跨列拖拽。
- **【新增】实现 `useDebounce.ts` hook，看板拖拽释放后延迟 300ms 调用 `move_to_stage`，期间再次拖拽则取消上次请求。**
- 乐观更新：前端先更新 UI，后调 API，失败则回滚。
验证：拖拽卡片后刷新页面状态保持；快速连续拖拽不会触发多次写操作，数据库无 locked 错误。

**Step 12 - 人才库基础（含缓存索引）**
**【变更】增加搜索索引缓存：**
实现 talent_pool 相关 commands。前端实现人才库页面：列表展示被淘汰候选人 + 筛选 + 搜索。实现人才激活功能。实现简历查重。
- **【新增】应用启动时调用 `get_candidate_search_index`，将结果存入 `candidateStore.nameMap` 和 `phoneLast4Map`。**
- 候选人增删改时同步更新 Map。
验证：淘汰→入库→复活链路通畅；快速记录搜索框响应 < 50ms。

**Step 13 - 跟进记录**
实现 follow_ups 相关 commands。前端在候选人详情页实现跟进记录 Tab。支持新增/删除跟进记录。
验证：跟进记录正常增删显示。

**Step 14 - 快速记录（含缓存索引）**
**【变更】利用 Step 12 的缓存索引优化体验：**
实现全局快捷键监听（Tauri global shortcut plugin 或前端 keyboard event）。实现 QuickRecord 浮层组件。
- 搜索框优先查本地 `nameMap`（前缀匹配），无结果时回退到后端模糊搜索。
- 支持输入 4 位数字查 `phoneLast4Map`。
- 提交后创建跟进记录。
验证：Ctrl+Shift+N 唤起浮层，输入姓名或手机号后 4 位快速定位候选人，回车提交成功。

### Phase 2 · 效率增强（预计 2 周）

**Step 15 - 候选人关系**
实现 candidate_relations 相关 commands。前端在候选人详情页实现关系 Tab。支持添加/删除关系。展示关联候选人和关系类型。
验证：添加关系后双方详情页都能看到。

**Step 16 - 待跟进提醒**
实现 get_today_follow_ups command。前端在侧边栏显示今日待跟进数量气标。点击展开列表，点击跳转候选人详情。
验证：有待跟进记录时气标正确显示。

**Step 17 - 批量操作（含二次确认）**
**【变更】增加操作二次确认：**
看板和列表视图支持多选。选中后底部出现批量操作栏。支持批量推进和批量淘汰。
- **【新增】点击批量操作按钮后弹出确认对话框，显示「即将对 N 位候选人执行 [操作]，是否继续？」**
验证：选中多个候选人后批量操作成功；误触概率降低。

**Step 18 - 简历预览（含兼容性验证）**
**【变更】增加 WebView 兼容性检测和降级：**
安装 react-pdf。在候选人详情页实现简历预览 Tab。PDF 渲染 + 翻页。Word/图片显示缩略图 + 下载按钮。
- **【新增】实现兼容性检测逻辑：**
  - 加载 PDF 时捕获 PDF.js Worker 初始化错误
  - 若检测到 blob: URL 相关错误，自动隐藏 react-pdf 渲染区，显示「在系统阅读器中打开」按钮
  - 按钮调用 Tauri `shell.openPath(resume.filePath)`
- **【新增】验证 react-pdf 在 Tauri WebView2 中的实际表现，若不稳定则切换到 `@react-pdf-viewer/core` 或系统默认阅读器方案。**
验证：PDF 文件能正确渲染；若 WebView 不兼容，降级方案可用。

**Step 19 - 批量导入（含统一校验）**
安装 xlsx (SheetJS)。实现导入弹窗：选择文件 → 预览数据 → 字段映射 → 确认导入。后端逐行处理，查重跳过。
- **【新增】每行数据组装为 `CreateCandidateInput`，通过 `validator` 校验，失败行计入 errors 数组。**
验证：Excel 文件能正确解析和导入；格式错误行被跳过并提示。

**Step 20 - 人才画像**
候选人详情页重构为画像视图。聚合：基本信息 + 简历 + 标签 + 跟进记录时间线 + 关系网络 + 应聘历史。
验证：所有信息在一个页面内完整展示。

### Phase 3 · 数据沉淀（预计 1-2 周）

**Step 21 - 仪表盘**
实现 stats 相关 commands（SQL 聚合查询）。前端实现仪表盘页面：4 个统计卡片 + 阶段分布柱状图。安装 echarts-for-react。
- **【新增】统计查询默认附加 `deleted_at IS NULL` 过滤。**
验证：数据与实际一致；已删除实体不计入统计。

**Step 22 - 数据导出（含字段勾选和排序）**
**【变更】由硬编码字段改为灵活配置：**
- 实现 `export.rs` 中的 `export_data` 和 `get_exportable_fields` commands。
- 实现 `ExportConfig.tsx` 组件：字段勾选器 + 拖拽排序面板。
- 前端弹窗收集用户配置后传给后端，后端按 `field_order` 动态查询和生成文件。
验证：导出弹窗可勾选字段、拖拽排序；导出文件列顺序与配置一致。

**Step 23 - 数据备份与恢复（Rust 端异步 + 自动回滚）**
**【变更】由前端 JSZip 改为 Rust 端 zip crate，增加自动回滚机制：**
- 移除前端 JSZip 依赖。
- 实现 Rust 端 `export_backup`：使用 `zip` crate + `walkdir` 异步打包 data/ 和 res/。
- 实现 Rust 端 `import_backup`：校验 → 创建 .bak 回滚点 → 解压覆盖。
- 实现 `rollback_backup`：从 .bak 恢复。
- 前端设置页增加进度条（监听 Tauri 事件）和回滚按钮。
- **【新增】恢复前二次确认对话框说明自动回滚机制。**
验证：备份 → 删除数据 → 恢复 → 数据完整；恢复异常时可回滚。

**Step 24 - 智能解析（可选）**
评估是否接入 Ollama 或第三方 OCR API。如接入：前端上传简历后调用解析接口，返回结构化数据自动填充表单。如不接入：跳过此步，手动录入完全可用。
验证：解析结果准确率可接受。

**Step 25 - 职位模板完善 + 流程模板**
完善职位模板的保存/加载逻辑。实现流程模板：保存当前阶段配置为模板，新建职位时可选模板。
验证：模板创建和复用正常。

---

## 九、约束与禁止事项

1. **禁止使用 localStorage 或 IndexedDB 存储业务数据**，所有持久化数据必须存 SQLite
2. **前端禁止直接引用 rusqlite 或任何数据库库**，必须通过 Tauri commands
3. **禁止引入未在技术栈列表中列出的大型库**，如需引入新库先说明理由
4. **禁止使用 class 组件**，全部函数式 + Hooks
5. **禁止硬编码颜色值**，使用 Tailwind 主题变量
6. **禁止跳过 TypeScript 类型定义**，所有 Tauri command 参数和返回值必须有类型
7. **禁止在数据库中存储文件内容**，只存文件路径
8. **禁止使用 eval() 或 new Function()**
9. **所有新增功能必须对应到上述步骤编号**，不要自行添加未列出的功能
10. **每个步骤完成后输出验证清单**，列出需要手动检查的点
11. **【新增】禁止物理删除核心实体（jobs、candidates）**，统一使用 `deleted_at` 软删除，彻底删除仅在回收站管理中提供
12. **【新增】禁止在 Tauri commands 中直接创建裸 Connection**，所有数据库操作必须通过 `DbPool` 获取连接
13. **【新增】禁止在前端高频写操作中直接调用 API**，必须经过至少 300ms 防抖（看板拖拽、批量操作）
14. **【新增】禁止在 commands 函数内部写分散的参数校验逻辑**，统一使用 `validate.rs` + `validator` crate
15. **【新增】禁止静默吞掉 ERROR 级别的异常**，所有 command 返回的 Err 必须至少记录到文件日志
16. **【新增】禁止修改已发布的 refinery 迁移脚本**，数据库结构变更必须新增版本号文件

---

## 十、UI 设计参考

- **视觉风格：** 暗色主题，参考 Linear / Raycast / Arc Browser
- **看板交互：** 参考 Trello / Notion 看板
- **列表交互：** 参考 Linear 的 issue list
- **快速记录：** 参考 Raycast / Alfred 的浮层交互
- **仪表盘布局：** 参考 Grafana 仪表盘
- **配色方案：**
  - 背景：#0f1117
  - 卡片：#1a1d24
  - 边框：#2a2d35
  - 主色：#3b82f6
  - 成功：#10b981
  - 警告：#f59e0b
  - 危险：#ef4444
  - 文字主色：#e2e8f0
  - 文字次色：#94a3b8

---

**技术方案最终确认：**

| 决策 | 选择 |
|---|---|
| 桌面框架 | **Tauri 2** |
| 前端框架 | **React 18 + TypeScript** |
| UI 组件库 | **shadcn/ui** |
| 状态管理 | **Zustand** |
| 图表库 | **ECharts** |
| PDF 预览 | **react-pdf**（主）/ **@react-pdf-viewer/core**（备选）/ 系统默认阅读器（降级） |
| 构建工具 | **Vite 5** |
| Excel 处理 | **SheetJS** |
| 数据库连接池 | **r2d2_sqlite** |
| 数据库迁移 | **refinery** |
| 文件压缩 | **zip (Rust crate)** |
| 输入校验 | **validator (Rust crate)** |
| 日志 | **log + simplelog (Rust crate)** |
