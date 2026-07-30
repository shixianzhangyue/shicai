# TalentVault 架构评估报告

**评估人:** Archi · 系统架构师
**日期:** 2025-05-22
**项目版本:** v0.1.0
**状态:** Proposed

---

## 一、项目概览

TalentVault 是一款本地化招聘管理桌面应用，核心功能包括候选人管理、职位管理、招聘流程管线（Pipeline）、人才库、跟进记录、简历解析（OCR + LLM）、云同步（OneDrive）、数据分析与导出备份。

**技术栈：**
| 层 | 技术选型 |
|---|---|
| 桌面框架 | Tauri v2 |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 状态管理 | Zustand 5 |
| UI 组件 | Radix UI + shadcn/ui 模式 |
| 后端 | Rust (edition 2021) |
| 数据库 | SQLite (rusqlite + r2d2 连接池) |
| 迁移 | refinery (embed_migrations) |
| 包管理 | pnpm |

---

## 二、ADR-001: 桌面框架选型 — Tauri v2 vs Electron

**状态:** Accepted

### 背景
项目需要一个跨平台桌面应用来承载招聘管理系统，前端使用 React/TS。

### 选项分析

| 维度 | Tauri v2 | Electron |
|------|----------|----------|
| 包体积 | ~5-15MB（使用系统 WebView） | ~150MB+（捆绑 Chromium） |
| 内存占用 | 低（~30-80MB） | 高（~150-300MB） |
| 后端能力 | Rust 原生性能，类型安全 | Node.js，生态丰富 |
| 安全性 | 沙箱隔离，默认最小权限 | 权限模型较宽松 |
| 生态成熟度 | v2 较新，社区增长中 | 极其成熟，插件丰富 |
| 跨平台 | Windows/macOS/Linux/iOS/Android | Windows/macOS/Linux |
| 学习曲线 | Rust 有一定门槛 | JavaScript 全栈，低门槛 |

### 评估
**选择 Tauri v2 是正确的决策。** 理由：
1. 招聘管理系统对资源占用敏感（HR 可能同时运行多个办公软件），Tauri 的轻量特性是核心优势
2. Rust 后端天然适合数据密集型操作（SQL 查询、简历解析、OCR 处理）
3. 项目后端使用了 `rusqlite`、`reqwest`、`pdf-extract` 等 Rust 生态库，验证了 Rust 在此类场景的可行性
4. Tauri v2 的插件体系（dialog/fs/shell）已满足当前需求

### 风险与建议
- **风险：** Tauri v2 仍处于快速迭代期，API 可能有 breaking changes
- **建议：** 锁定 Tauri 版本范围，定期评估升级收益；团队应关注 Tauri 迁移指南

---

## 三、ADR-002: 数据库选型 — SQLite

**状态:** Accepted

### 背景
系统需要持久化存储候选人、职位、管线、跟进等数据，部署环境为本地桌面。

### 选项分析

| 维度 | SQLite | PostgreSQL (嵌入式) | sled/LMDB (KV) |
|------|--------|---------------------|-----------------|
| 部署复杂度 | 零配置，单文件 | 需安装服务 | 零配置 |
| SQL 支持 | 完整 SQL | 完整 SQL | 无 |
| 并发能力 | 单写多读 | 高并发 | 高并发 |
| 数据类型 | 动态类型，JSON 支持 | 丰富类型，JSONB | KV 存储 |
| 备份 | 文件复制 | pg_dump | 文件复制 |
| 适合场景 | 桌面单用户应用 | 服务端多用户 | 高性能缓存 |

### 评估
**SQLite 是最佳选择。** 理由：
1. 桌面单用户场景，并发需求低，SQLite 的单写锁完全够用
2. 零配置部署，用户无需安装额外软件
3. 完整的 SQL 支持使得复杂查询（分页、聚合、JOIN）可以原生实现
4. 单文件数据库便于备份/恢复（项目已实现 `export_backup` / `import_backup`）

### 当前问题与建议

**P1 - 连接池 max_size=1 的必要性与隐患：**
```rust
// pool.rs
Pool::builder().max_size(1).build(manager)
```
- 优点：避免 SQLite 写锁冲突
- 隐患：所有操作串行执行，在大量数据时 UI 可能出现卡顿
- **建议：** 保持 max_size=1，但对耗时操作（如导出、备份、简历解析）考虑使用异步任务队列，避免阻塞 UI 线程

**P2 - JSON 列的使用模式：**
项目中多处使用 TEXT 列存储 JSON（`tags`, `work_experiences`, `education_history`, `parsed_data`）。
- 优点：灵活，避免频繁 DDL
- 隐患：无法对 JSON 内部字段建索引，查询性能受限
- **建议：** 当前数据量（<10万条）下可接受；tags 查询使用 `LIKE '%"tag"%'` 模式（已在代码中实现）在万级数据下性能尚可。若未来数据量增长，建议将高频查询的 tags 迁移为关联表

---

## 四、ADR-003: 状态管理 — Zustand vs Redux

**状态:** Accepted

### 背景
前端需要管理候选列表、职位列表、管线状态、UI 状态等。

### 选项分析

| 维度 | Zustand 5 | Redux Toolkit | Jotai/Recoil |
|------|-----------|---------------|--------------|
| 模板代码 | 极少 | 中等（slice 模式） | 少 |
| 学习曲线 | 低 | 中 | 低-中 |
| DevTools | 有（zustand/middleware） | 优秀（Redux DevTools） | 有 |
| 异步处理 | 原生 async/await | thunk/saga | 原生 |
| 包体积 | ~1KB | ~11KB | ~3KB |
| TypeScript | 优秀 | 优秀 | 优秀 |

### 评估
**Zustand 是适合当前团队和项目规模的好选择。** 理由：
1. 模板代码少，7 个 store 文件总计约 500 行，维护成本低
2. `create<State>((set, get) => ({...}))` 模式直观，与 React hooks 生态自然融合
3. 包体积极小，对桌面应用的启动性能无影响

### 当前问题

**P1 - Store 间缺乏协调机制：**
当前各 store 独立运作，`candidateStore` 的 `fetchCandidates()` 不会触发 `pipelineStore` 更新，反之亦然。当用户在管线中移动候选人后，候选人列表的状态可能不同步。

**建议：**
- 引入轻量级事件总线（如 zustand 的 `subscribe` + 自定义 middleware）
- 或在关键操作后手动调用相关 store 的刷新方法

**P2 - 搜索索引在 candidateStore 中的职责过重：**
`nameMap` 和 `phoneLast4Map` 的维护逻辑（addToSearchIndex/removeFromSearchIndex）与候选人的 CRUD 操作耦合在一个 store 中。

**建议：** 考虑抽取为独立的 `searchIndexStore`，通过 subscribe 机制自动响应候选人变更

---

## 五、ADR-004: 数据库迁移策略

**状态:** Accepted

### 背景
项目使用 refinery 进行数据库迁移，迁移文件嵌入二进制。

### 当前迁移矩阵
| 版本 | 内容 | 状态 |
|------|------|------|
| V1 | 初始表结构（jobs, candidates, resumes, pipeline_stages, candidate_pipeline, follow_ups, candidate_relations, tags, job_templates, stats_cache） | OK |
| V2 | 审计日志表（audit_logs） | OK |
| V3 | schema 版本确认表 | OK |
| V5 | LLM 配置表 | OK |
| V6 | 职位 headcount 字段 | OK |
| V7 | OCR 配置表 | OK |
| V8 | 候选人增强字段（gender, school 等 12 个字段 + 索引 + user_preferences） | OK |
| V9 | 云同步配置与日志 | OK |
| V10 | 简历多版本 + 作品集 + 解析日志 | OK |
| V11 | 跟进模板 + 跟进增强 | OK |
| V12 | 候选人模块增强（avatar, age, last_active_at + pipeline 增强） | OK |
| V13 | 允许 pipeline 中 job_id 为 NULL（talent pool 入口） | OK |

### 评估
- **正向：** 使用 `embed_migrations!` 宏将迁移文件编译进二进制，避免运行时文件路径问题
- **正向：** 迁移编号从 V1 到 V13（注意缺少 V4），结构清晰
- **正向：** V13 使用了 "创建新表 → 复制数据 → 删除旧表 → 重命名" 的安全模式处理 SQLite 不支持 ALTER COLUMN 的限制

### 问题与建议

**P1 - 缺少 V4 迁移：**
迁移编号跳跃（V3 → V5），虽然 refinery 按文件名排序执行不会出错，但会造成维护困惑。

**建议：** 在文档或迁移文件注释中说明 V4 被跳过的原因（可能已删除或合并）

**P2 - 迁移回滚策略不足：**
`migrations.rs` 中的 checksum mismatch 处理会直接 `DROP TABLE IF EXISTS refinery_schema_history` 然后重新执行所有迁移——这意味着数据丢失。

```rust
// migrations.rs:31
conn.execute_batch("DROP TABLE IF EXISTS refinery_schema_history;")
```

**建议：**
1. 在执行 schema 重置前自动备份数据库文件
2. 添加迁移前的数据备份机制
3. 考虑使用 `backup::export_backup` 的逻辑作为迁移前的保护措施

**P3 - 迁移中的数据回填：**
V12 最后两行做了数据回填：
```sql
UPDATE candidates SET last_active_at = created_at WHERE last_active_at IS NULL;
UPDATE candidate_pipeline SET applied_at = entered_at WHERE applied_at IS NULL;
```
这是良好实践，但应确保在大数据量下不会导致迁移超时。

---

## 六、ADR-005: 前后端通信模式

**状态:** Accepted

### 背景
Tauri 通过 IPC（`invoke`）实现前端到 Rust 后端的函数调用。

### 当前模式
```
React Component → Zustand Store → api.ts (invoke) → Tauri IPC → Rust Command → SQLite
```

### 评估

**正向：**
1. `api.ts` 作为统一的 API 层，封装了所有 Tauri invoke 调用，职责清晰
2. 前端使用 camelCase，后端使用 snake_case，`api.ts` 中的 `map*Input` 函数负责转换
3. 所有 Tauri command 都有 `Result<T, String>` 返回类型，错误通过字符串传递

### 问题与建议

**P1 - 错误处理过于简单：**
所有 Rust 命令返回 `Result<T, String>`，前端只能拿到错误字符串，无法区分错误类型（网络错误、验证错误、业务逻辑错误）。

```rust
// 当前模式
.map_err(|e| format!("Failed to create candidate: {}", e))
```

**建议：** 引入结构化错误类型：
```rust
#[derive(Serialize)]
#[serde(tag = "type")]
enum AppError {
    Validation { field: String, message: String },
    NotFound { entity: String, id: String },
    Conflict { message: String },
    Database { message: String },
    External { service: String, message: String },
}
```
这将使前端能根据错误类型展示不同的 UI（如表单验证高亮 vs 通用错误提示）

**P2 - 手动参数映射脆弱：**
`api.ts` 中 `mapCreateCandidateInput` 和 `mapUpdateCandidateInput` 手动逐字段映射，新增字段时容易遗漏。

**建议：** 
- 使用 `snakecase-keys` 等库自动转换，或
- 在 Rust 端的 `#[tauri::command]` 宏中使用 `rename_all = "camelCase"`（已部分使用）

**P3 - 缺少请求/响应的类型校验：**
前端 `invoke` 调用的返回类型仅在 TypeScript 编译时检查，运行时 Rust 返回的数据可能与 TS 类型不匹配。

**建议：** 考虑在关键 API 中添加运行时校验（如 zod），或确保 Rust 端的 `#[serde(rename_all = "camelCase")]` 与 TS 类型定义严格一致

---

## 七、ADR-006: 模块化与代码组织

**状态:** Accepted

### 当前目录结构

```
src-tauri/src/
├── lib.rs              # 入口，Tauri Builder 配置
├── commands/           # 19 个模块，每个对应一个业务域
│   ├── mod.rs
│   ├── candidates.rs   # 716 行
│   ├── pipeline.rs     # 1093 行 ← 最大文件
│   ├── jobs.rs         # 459 行
│   ├── backup.rs       # ~500 行
│   ├── ...
│   └── ocr_configs.rs
├── services/           # 业务服务层
│   ├── llm_client.rs   # 23KB - LLM 客户端
│   ├── onedrive.rs     # OneDrive 云同步
│   ├── duplicate_detector.rs
│   ├── analytics_engine.rs
│   ├── baidu_ocr.rs
│   ├── text_extractor.rs
│   ├── text_parser.rs
│   └── prompt.rs
├── db/
│   ├── mod.rs          # init_db
│   ├── pool.rs         # 连接池
│   └── migrations.rs   # refinery 集成
├── validate.rs         # 输入验证
└── logger.rs           # 日志初始化
```

### 评估

**正向：**
1. **分层清晰：** commands（路由层）→ services（业务逻辑层）→ db（数据层），职责分明
2. **业务域划分合理：** 19 个 command 模块覆盖了完整的业务域
3. **services 层的存在** 将 LLM 客户端、OCR、重复检测等复杂逻辑从 commands 中解耦

### 问题与建议

**P1 - commands 层缺少 repository/service 层抽象：**
当前 commands 直接编写 SQL，例如 `candidates.rs` 中 716 行大量是 SQL 构建和参数绑定代码。

```rust
// candidates.rs - SQL 直接在 command 中
let sql = format!(
    "SELECT {} FROM candidates c {} ORDER BY c.{} {} LIMIT ? OFFSET ?",
    CANDIDATE_COLUMNS, where_clause, sort_field, order
);
```

**建议：** 引入 Repository 模式：
```rust
// db/candidate_repo.rs
pub struct CandidateRepo<'a> {
    conn: &'a rusqlite::Connection,
}

impl<'a> CandidateRepo<'a> {
    pub fn list(&self, filters: &CandidateFilters, page: Pagination) -> Result<PaginatedResult<Candidate>> { ... }
    pub fn find_by_id(&self, id: &str) -> Result<Option<Candidate>> { ... }
    pub fn create(&self, input: &CreateCandidateInput) -> Result<Candidate> { ... }
}
```
好处：SQL 逻辑可测试、commands 层更薄、可复用

**P2 - pipeline.rs 过大（1093 行）：**
单文件包含 18+ 个 Tauri command，结构、管道条目、统计、批量操作全部混在一个文件中。

**建议：** 拆分为：
- `pipeline/stages.rs` — 阶段 CRUD
- `pipeline/entries.rs` — 管线条目操作（add_to_job, move_to_stage 等）
- `pipeline/batch.rs` — 批量操作
- `pipeline/stats.rs` — 统计查询

**P3 - Entity 结构体重复定义：**
`Candidate`、`Job`、`PipelineEntry` 等实体在各自 command 文件中定义，但 `types/index.ts` 中也有对应的 TypeScript 接口。当 Rust 结构体变更时，需要同步更新 TS 类型。

**建议：** 
- 考虑使用 `ts-rs` 等 crate 从 Rust 结构体自动生成 TypeScript 类型
- 或建立 CI 检查确保两侧类型一致

---

## 八、ADR-007: 扩展性评估

**状态:** Proposed

### 当前架构支持的扩展方向

| 扩展方向 | 架构支持度 | 需要的改动 |
|---------|----------|-----------|
| 新增业务实体（如 Interview） | 高 | 新增 command 模块 + migration + store + 页面 |
| 新增 AI 能力 | 高 | services 层已有 LLM 客户端，可复用 |
| 多用户/团队协作 | 低 | 需要引入用户认证、权限、数据库迁移为 PostgreSQL |
| Web 版本 | 中 | Tauri 已分离前端/后端，前端可独立部署，但后端需改写 |
| 插件系统 | 中 | Tauri v2 的插件体系可利用，但需设计内部插件 API |
| 移动端 | 中 | Tauri v2 支持移动端，但 UI 需要适配 |

### 关键扩展性建议

**1. 数据访问层抽象（优先级：高）**
当前 command 直接写 SQL 的模式使得：
- 添加新的查询维度需要修改大量代码
- 无法轻松切换数据库后端
- 难以进行单元测试

**2. 事件驱动架构（优先级：中）**
当前操作是同步请求-响应模式。引入事件系统可以：
- 解耦跨模块的副作用（如候选人创建后自动更新搜索索引）
- 支持撤销/重做功能
- 为将来的实时通知打基础

**3. 配置外部化（优先级：低）**
当前默认管线阶段硬编码在 Rust 和 TS 两端：
```rust
// pipeline.rs:233
let default_stages = vec![
    ("简历筛选", 1), ("初试", 2), ("复试", 3), ("HR面", 4), ("录用", 5),
];
```
```typescript
// constants.ts
export const DEFAULT_PIPELINE_STAGES = ['简历筛选', '初面', '复面', '终面', '待入职'];
```
注意两者内容不一致！Rust 端是"初试/复试/HR面/录用"，TS 端是"初面/复面/终面/待入职"。

**建议：** 统一为一个数据源（数据库配置或 Rust 端 constants 通过 IPC 暴露）

---

## 九、数据库 ER 图（核心实体关系）

```
┌───────────┐     ┌──────────────────┐     ┌────────────────┐
│   jobs    │────<│ candidate_pipeline│>────│  candidates    │
│           │     │                  │     │                │
│ id (PK)   │     │ id (PK)          │     │ id (PK)        │
│ title     │     │ candidate_id(FK) │     │ name           │
│ department│     │ job_id (FK)      │     │ phone          │
│ salary_min│     │ current_stage_id │     │ email          │
│ salary_max│     │ status           │     │ education      │
│ status    │     │ entered_at       │     │ years_exp      │
│ tags(JSON)│     │ interview_*      │     │ tags(JSON)     │
│ headcount │     └──────────────────┘     │ work_exp(JSON) │
│ deleted_at│            │                 │ school         │
└───────────┘            │                 │ deleted_at     │
       │                 v                 └────────────────┘
       │     ┌──────────────────┐                │
       │     │ pipeline_stages  │                │
       │     │                  │                v
       │     │ id (PK)          │     ┌──────────────────┐
       └────>│ job_id (FK)      │     │    resumes       │
             │ name             │     │                  │
             │ sort_order       │     │ id (PK)          │
             └──────────────────┘     │ candidate_id(FK) │
                                      │ file_path        │
┌─────────────┐                       │ parsed_data(JSON)│
│ follow_ups  │                       │ resume_type      │
│             │                       │ version          │
│ id (PK)     │<──────────────────────└──────────────────┘
│ candidate_id│
│ content     │     ┌──────────────────┐
│ follow_type │     │ candidate_relations│
│ next_date   │     │                  │
│ template_id │     │ candidate_id_a   │
└─────────────┘     │ candidate_id_b   │
                    │ relation_type    │
┌─────────────┐     └──────────────────┘
│    tags     │
│ id (PK)     │     ┌──────────────────┐
│ name (UQ)   │     │ llm_configs      │
│ color       │     │ ocr_configs      │
└─────────────┘     │ cloud_sync_*     │
                    │ audit_logs       │
                    │ user_preferences │
                    │ follow_up_templates│
                    │ portfolios       │
                    └──────────────────┘
```

---

## 十、发现的代码质量问题汇总

| # | 严重度 | 问题 | 位置 | 建议 |
|---|--------|------|------|------|
| 1 | P0 | CSP 设置为 null（禁用） | tauri.conf.json:28 | 应设置合理的 CSP 策略，至少限制 script-src |
| 2 | P1 | 默认管线阶段前后端不一致 | pipeline.rs vs constants.ts | 统一为单一数据源 |
| 3 | P1 | 错误类型全部为 String | 全局 commands 层 | 引入结构化错误类型 |
| 4 | P1 | 迁移 checksum mismatch 时丢失数据 | migrations.rs:31 | 先备份再重置 |
| 5 | P2 | SQL 注入风险（间接） | candidates.rs 动态 SQL 构建 | 使用参数化查询而非 format! 拼接 sort_field |
| 6 | P2 | update 操作中参数绑定顺序依赖 | candidates.rs, jobs.rs | 重构为更安全的绑定模式 |
| 7 | P2 | pipeline.rs 单文件 1093 行 | pipeline.rs | 拆分为子模块 |
| 8 | P2 | Store 间状态不同步 | candidateStore vs pipelineStore | 引入事件/订阅机制 |
| 9 | P3 | 缺少 V4 迁移 | migrations/ | 添加注释说明 |
| 10 | P3 | tags 使用 LIKE 查询，性能随数据增长下降 | candidates.rs | 数据量大时迁移为关联表 |

### P2 详细说明 — SQL 排序字段注入

```rust
// candidates.rs:217-223
let sort_field = sort_by
    .filter(|s| allowed_sort_fields.contains(&s.as_str()))
    .unwrap_or_else(|| "created_at".to_string());
// ...
let sql = format!("... ORDER BY c.{} {} LIMIT ? OFFSET ?", sort_field, order);
```
虽然有白名单校验（`allowed_sort_fields`），但 `sort_field` 仍通过 `format!` 直接插入 SQL。当前白名单保护了安全性，但建议重构为 match 表达式以消除 format! 注入模式：

```rust
let order_clause = match sort_by.as_deref() {
    Some("name") => "c.name",
    Some("years_exp") => "c.years_exp",
    _ => "c.created_at",
};
```

---

## 十一、总体评价

### 架构成熟度评分（5 分制）

| 维度 | 评分 | 说明 |
|------|------|------|
| 技术选型 | ⭐⭐⭐⭐ | Tauri + SQLite + Zustand 组合适合场景 |
| 数据库设计 | ⭐⭐⭐⭐ | 表结构合理，迁移体系完整，索引覆盖到位 |
| API 设计 | ⭐⭐⭐ | 功能完整，但错误处理和类型安全可改进 |
| 模块化 | ⭐⭐⭐ | 分层清晰，但 commands 层过厚，缺少 repository 抽象 |
| 可扩展性 | ⭐⭐⭐ | 支持新业务实体，但缺乏数据访问抽象层 |
| 安全性 | ⭐⭐⭐ | 输入验证到位，CSP 和 SQL 注入防护需加强 |
| 代码质量 | ⭐⭐⭐⭐ | 整体整洁，日志完善，有审计日志机制 |

**综合评价：** TalentVault 的架构设计对于当前规模（单用户桌面招聘管理系统）是**合理且实用的**。技术栈选择务实，数据库设计规范，业务域划分清晰。主要改进方向集中在：错误类型结构化、数据访问层抽象、跨模块状态同步。

### 优先级路线图

1. **短期（1-2 周）：** 统一默认管线阶段、设置 CSP 策略、修复迁移备份机制
2. **中期（1-2 月）：** 引入 Repository 模式、结构化错误类型、拆分 pipeline.rs
3. **长期（3+ 月）：** 事件驱动架构、自动类型生成（ts-rs）、性能基准测试
