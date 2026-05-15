# TalentVault Phase 3 增量 PRD

> **版本：** v1.0
> **日期：** 2026-05-14
> **范围：** Step 21-23, Step 25（数据沉淀阶段）
> **依赖：** Phase 1-2（Step 1-20）已完成

---

## 1. 产品目标

为 TalentVault 补齐数据洞察、数据流通与流程复用能力，使用户能够通过仪表盘实时掌握招聘漏斗状态，灵活导出候选人数据，安全地备份与恢复本地数据，并通过流程模板大幅提升新建职位的效率。

---

## 2. 用户故事

### Step 21 - 仪表盘
- **US-21-1**：As a 猎头顾问，I want 在首页看到当前在招职位数、候选人总数、今日待跟进数和人才库人数，so that 我能在 3 秒内掌握今日工作全貌。
- **US-21-2**：As a 猎头顾问，I want 看到各职位在各招聘阶段的人数分布堆叠柱状图，so that 我能快速识别哪些职位在哪个环节出现瓶颈。

### Step 22 - 数据导出
- **US-22-1**：As a 猎头顾问，I want 勾选需要导出的候选人字段并拖拽排序，so that 导出的 Excel/CSV 文件列顺序符合我向客户汇报的习惯。
- **US-22-2**：As a 猎头顾问，I want 按全部/当前筛选结果/某职位三种范围导出数据，so that 我能灵活导出不同场景需要的数据集。

### Step 23 - 数据备份与恢复
- **US-23-1**：As a 猎头顾问，I want 一键将数据库和简历文件打包为 zip 备份，so that 我能定期保护本地数据防止意外丢失。
- **US-23-2**：As a 猎头顾问，I want 恢复备份前系统自动创建回滚点，并在异常时一键回滚，so that 我敢放心地恢复历史数据而不担心当前数据被不可逆覆盖。

### Step 25 - 职位模板完善 + 流程模板
- **US-25-1**：As a 猎头顾问，I want 将当前职位的阶段配置保存为流程模板，so that 我以后创建相似职位时无需重复配置流程阶段。
- **US-25-2**：As a 猎头顾问，I want 新建职位时从下拉菜单选择流程模板自动创建阶段，so that 我能在 10 秒内完成职位创建并直接进入招聘流程。

---

## 3. 需求池

### P0 - Must Have（阻塞上线）

| ID | 需求 | 对应 Step | 说明 |
|---|---|---|---|
| P0-1 | `get_funnel_data` Command | Step 21 | 后端实现：按职位 ID 或全局统计各阶段候选人数量，返回 `{stage, count}[]` |
| P0-2 | 仪表盘统计卡片真实数据 | Step 21 | Dashboard.tsx 连接 `get_overview_stats`，4 张卡片展示真实数字 |
| P0-3 | 漏斗堆叠柱状图 | Step 21 | ECharts 堆叠柱状图：X 轴=职位名，Y 轴=人数，系列=阶段名；支持按职位筛选 |
| P0-4 | `export_data` Command | Step 22 | 后端实现：按 `ExportConfig` 动态查询，生成 xlsx/csv 文件，字段顺序严格按 `field_order` |
| P0-5 | `get_exportable_fields` Command | Step 22 | 后端返回可导出字段元数据（key + 中文标签） |
| P0-6 | 导出配置弹窗 UI | Step 22 | `ExportConfig.tsx`：左侧字段勾选器 + 右侧拖拽排序区 + 格式/范围选择 |
| P0-7 | `export_backup` Command | Step 23 | Rust 端异步 zip 打包：data/talent.db + res/ 目录，通过 Tauri 事件向前端报告进度 |
| P0-8 | `import_backup` Command | Step 23 | 安全恢复：校验 zip → 创建 .bak 回滚点 → 解压覆盖 → 提示重启 |
| P0-9 | `rollback_backup` Command | Step 23 | 从最新 .bak 文件回滚 data/ 和 res/ |
| P0-10 | 备份恢复 UI | Step 23 | Settings.tsx 增加：导出备份按钮、导入恢复按钮（含进度提示）、回滚按钮 |
| P0-11 | `pipeline_templates` 表 | Step 25 | 新增迁移脚本 V4__pipeline_templates.sql：字段 id, name, stages_json, created_at |
| P0-12 | 流程模板 CRUD Commands | Step 25 | `list_pipeline_templates`, `create_pipeline_template`, `delete_pipeline_template` |
| P0-13 | 职位表单「保存为模板」+「从模板创建」| Step 25 | JobForm 增加保存按钮；新建职位时支持下拉选择流程模板自动创建阶段 |
| P0-14 | api.ts 补齐 stats/export/backup API | Step 21-23 | 前端封装层新增缺失的 API 调用 |

### P1 - Should Have（体验优化）

| ID | 需求 | 对应 Step | 说明 |
|---|---|---|---|
| P1-1 | 仪表盘加载骨架屏 | Step 21 | 数据加载中显示 shadcn Skeleton，避免白屏 |
| P1-2 | 导出文件自动打开目录 | Step 22 | 导出成功后调用 Tauri shell API 打开文件所在文件夹 |
| P1-3 | 备份历史管理 | Step 23 | 设置页展示最近 3 个 .bak 文件，支持选择回滚到指定时间点 |
| P1-4 | 流程模板默认内置 | Step 25 | 应用首次启动时自动插入 2 个默认流程模板（标准 5 阶段、精简 3 阶段） |
| P1-5 | 导出范围「当前筛选结果」| Step 22 | 与候选人列表页筛选状态联动，导出当前列表可见数据 |

### P2 - Nice to Have（增值功能）

| ID | 需求 | 对应 Step | 说明 |
|---|---|---|---|
| P2-1 | 仪表盘数据自动刷新 | Step 21 | 每 5 分钟轮询或切换页面时刷新 |
| P2-2 | 导出模板记忆 | Step 22 | 记住用户上次的字段选择和排序，下次默认恢复 |
| P2-3 | 备份定时提醒 | Step 23 | 超过 7 天未备份时在侧边栏显示提醒徽标 |
| P2-4 | Step 24 智能解析 | Step 24 | 评估接入 Ollama 或 OCR API 自动解析简历，本次迭代跳过不影响主线 |

---

## 4. 详细交互流程

### 4.1 Step 21 - 仪表盘

#### 4.1.1 页面结构
```
Dashboard.tsx
├── 顶部标题区："仪表盘" + 今日日期
├── 统计卡片区（4 列 Grid）
│   ├── 在招职位数（蓝色）→ 点击跳转 /jobs?status=open
│   ├── 候选人总数（绿色）→ 点击跳转 /talent-pool
│   ├── 今日待跟进数（橙色，>0 时高亮）→ 点击展开侧边栏待跟进列表
│   └── 人才库人数（紫色）→ 点击跳转 /talent-pool?status=pooled
├── 图表区
│   └── ECharts 堆叠柱状图：各职位各阶段人数分布
│       └── 顶部筛选：「全部职位」下拉，可单选某个职位聚焦
└── 快捷入口区（可选）
    └── 今日待跟进列表前 5 条
```

#### 4.1.2 数据流
1. 页面 `useEffect` 挂载时并行调用：
   - `api.stats.overview()` → 4 张卡片数据
   - `api.stats.funnel()` → 全局漏斗数据
2. 用户从下拉框选择特定职位时：
   - 调用 `api.stats.funnel(jobId)` 更新图表
3. 图表数据格式转换：
   - 后端返回按 stage 聚合的数组
   - 前端 pivot 为 ECharts series 格式：`{ name: stageName, data: [job1Count, job2Count, ...] }`

#### 4.1.3 边界处理
- 无职位数据时：图表区显示空状态插画 + "暂无职位数据，去创建第一个职位"
- 有职位但无候选人时：图表显示全 0，Y 轴隐藏，X 轴显示职位名
- 软删除过滤：所有 stats SQL 必须附加 `deleted_at IS NULL`

---

### 4.2 Step 22 - 数据导出

#### 4.2.1 触发入口
- 仪表盘右上角「导出」按钮
- 候选人列表页右上角「导出」按钮（携带当前筛选参数）

#### 4.2.2 ExportConfigDialog 交互流程
```
1. 点击「导出」→ 打开 Dialog（maxWidth=md）
2. Dialog 内容区（左右分栏）：
   ├── 左侧「选择字段」（宽 45%）
   │   └── 全选/取消全选 Checkbox
   │   └── 字段列表（每项：Checkbox + 中文标签）
   │       └── 默认全选，禁用状态至少保留 1 个勾选
   └── 右侧「排序字段」（宽 55%，灰色背景卡片）
       └── @dnd-kit/sortable 列表
           └── 每项显示字段标签 + 拖拽手柄
           └── 未勾选的字段不显示在此区域
3. 底部配置栏：
   ├── 格式选择：xlsx（默认）/ csv → RadioGroup
   ├── 范围选择：全部 / 当前筛选结果 / 某职位 → RadioGroup + 职位下拉（当选择「某职位」时显示）
   └── 操作按钮：取消 / 确认导出
4. 点击「确认导出」→
   ├── 调用 Tauri save dialog 获取保存路径
   ├── 组装 ExportConfig → 调用 api.export.export(config)
   ├── 后端生成文件 → 返回文件路径
   └── 前端 toast 提示「导出成功」并提供「打开目录」按钮
```

#### 4.2.3 后端生成逻辑
1. 根据 `scope` 构建 WHERE 子句：
   - `all`: `deleted_at IS NULL`
   - `filtered`: 追加当前筛选条件（需前端传入 filter 参数）
   - `job`: `candidate_pipeline.job_id = ? AND deleted_at IS NULL`
2. 按 `field_order` 顺序 SELECT 对应列
3. 使用 `xlsx` crate（Rust 端）或前端 SheetJS 生成文件；**推荐 Rust 端生成**，避免大文件跨进程传输
4. 字段映射示例：
   - `name` → `candidates.name`
   - `tags` → JSON 解析后逗号拼接
   - `createdAt` → 格式化为 `YYYY-MM-DD`

---

### 4.3 Step 23 - 数据备份与恢复

#### 4.3.1 设置页布局（Settings.tsx 新增「数据管理」Tab）
```
数据管理 Tab
├── 备份区（卡片）
│   ├── 标题：数据备份
│   ├── 描述：将数据库和所有简历文件打包为 zip 存档
│   ├── 上次备份时间（从本地存储读取，若无显示「从未备份」）
│   └── 「导出备份」按钮（primary）
├── 恢复区（卡片）
│   ├── 标题：数据恢复
│   ├── 描述：从备份文件恢复数据。系统会在恢复前自动创建回滚点。
│   ├── 警告提示（Alert 组件，黄色）：恢复将覆盖当前所有数据
│   └── 「导入恢复」按钮（secondary，带上传图标）
└── 回滚区（卡片，仅在检测到 .bak 文件时显示）
    ├── 标题：回滚管理
    ├── 描述：如果上次恢复后出现异常，可回滚到恢复前的状态
    ├── 最近备份点列表（文件名 + 创建时间）
    └── 「回滚到选中版本」按钮（danger）
```

#### 4.3.2 导出备份流程
```
1. 用户点击「导出备份」
2. 调用 Tauri save dialog，默认文件名：talent-vault-backup-{YYYY-MM-DD-HHmm}.zip
3. 调用 api.backup.export(outputPath)
4. Rust 端异步执行：
   ├── 获取 app_data_dir
   ├── 创建 zip 写入器
   ├── walkdir 遍历 data/ 和 res/
   ├── 写入 zip（每写入 10% 通过 Tauri Channel 发送进度事件）
   └── 完成返回文件路径
5. 前端监听进度事件，更新 Progress 组件
6. 完成后 toast 提示，记录「上次备份时间」到 localStorage
```

#### 4.3.3 导入恢复流程
```
1. 用户点击「导入恢复」
2. 调用 Tauri open dialog，过滤器：*.zip
3. 用户选择文件后弹出二次确认 Dialog：
   ├── 标题：确认恢复数据？
   ├── 内容：恢复将覆盖当前所有数据。系统已自动创建回滚备份（.bak），可在异常时回滚。
   ├── 显示选中的文件名
   └── 按钮：取消 / 确认恢复
4. 点击确认 → 调用 api.backup.import(zipPath)
5. Rust 端执行：
   ├── 校验 zip：必须包含 talent.db
   ├── 创建回滚点：
   │   ├── data/talent.db → data/talent.db.{timestamp}.bak
   │   └── res/ → res.{timestamp}.bak/
   ├── 清理旧 .bak（只保留最近 3 个）
   ├── 解压 zip 覆盖 data/ 和 res/
   └── 返回成功
6. 前端显示 Alert：「恢复成功，请重启应用以完成数据加载」+ 「立即重启」按钮
7. 若 Rust 返回 Err：前端显示错误详情，并在回滚区高亮「一键回滚」按钮
```

#### 4.3.4 回滚流程
```
1. 设置页检测到存在 *.bak 文件时显示回滚区
2. 用户选择某个备份点（Radio 选择）
3. 点击「回滚到选中版本」→ 二次确认：「回滚将丢弃恢复后的所有变更，是否继续？」
4. 调用 api.backup.rollback()
5. Rust 端：
   ├── 找到最新的 .bak 文件
   ├── 将当前 data/talent.db 和 res/ 移为 .rollback 临时备份
   ├── 将 .bak 恢复为当前数据
   └── 返回成功
6. 前端提示重启应用
```

---

### 4.4 Step 25 - 职位模板完善 + 流程模板

#### 4.4.1 数据库变更
新增迁移文件 `V4__pipeline_templates.sql`：
```sql
CREATE TABLE IF NOT EXISTS pipeline_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stages_json TEXT NOT NULL,  -- JSON array: [{"name": "简历筛选", "sort_order": 0}, ...]
  created_at TEXT NOT NULL
);
```

#### 4.4.2 职位表单变更（JobForm.tsx）
```
表单底部操作栏新增：
├── 「保存为职位模板」按钮（outline 样式）
│   └── 点击：弹出输入框「模板名称」（默认=当前职位标题），确认后调用 api.jobTemplates.create
└── 流程模板区（新建模式时显示）
    ├── 标签：流程模板
    ├── Select 下拉：「使用默认流程」/ 已保存的流程模板列表
    └── 选择模板后，下方预览显示该模板的阶段列表（只读标签组）
```

#### 4.4.3 新建职位流程（含流程模板）
```
1. 用户进入 /jobs/new
2. 填写职位基本信息
3. 流程模板 Select 默认选中「使用默认流程」
4. 用户可切换为自定义模板，下方实时预览阶段
5. 点击「发布」→
   ├── 创建职位记录
   ├── IF 选择了非默认模板：
   │   └── 读取 pipeline_templates.stages_json
   │   └── 为每个 stage 调用 create_stage（job_id=新职位ID）
   └── ELSE：
       └── 调用 init_default_stages（保持现有行为）
6. 创建完成后跳转到职位详情页
```

#### 4.4.4 职位详情页「流程配置」Tab 增强
```
StageConfig.tsx 新增：
├── 阶段列表（现有功能：排序、增删改）
└── 底部操作栏新增：「保存为流程模板」按钮
    └── 点击：弹出 Dialog「模板名称」（默认="{职位标题} 流程"）
    └── 确认后：将当前 stages 序列化为 JSON，调用 create_pipeline_template
```

#### 4.4.5 后端 Commands 新增
```rust
// src-tauri/src/commands/pipeline.rs 或新建 pipeline_templates.rs
#[tauri::command]
fn list_pipeline_templates(state: tauri::State<DbPool>) -> Result<Vec<PipelineTemplate>, String>

#[tauri::command]
fn create_pipeline_template(
    state: tauri::State<DbPool>,
    name: String,
    stages_json: String
) -> Result<PipelineTemplate, String>

#[tauri::command]
fn delete_pipeline_template(state: tauri::State<DbPool>, id: String) -> Result<(), String>

// 类型定义
pub struct PipelineTemplate {
    pub id: String,
    pub name: String,
    pub stages_json: String,
    pub created_at: String,
}
```

---

## 5. 验收标准

### 5.1 Step 21 - 仪表盘
- [ ] `get_overview_stats` 返回的 4 个数字与数据库实际计数一致（±0）
- [ ] 已软删除的职位和候选人**不计入**任何统计
- [ ] `get_funnel_data()` 返回所有职位在所有阶段的聚合数据
- [ ] `get_funnel_data(jobId)` 返回单个职位的阶段分布
- [ ] 4 张统计卡片点击后正确跳转到对应页面（带筛选参数）
- [ ] ECharts 堆叠柱状图在数据为空时显示友好空状态，不报错
- [ ] 图表在暗色主题下文字和网格线颜色可读（非默认黑色）
- [ ] 加载过程中显示骨架屏或 Loading Spinner，无白屏

### 5.2 Step 22 - 数据导出
- [ ] `get_exportable_fields` 返回 10 个字段的中文标签（姓名/手机/邮箱/公司/职位/学历/经验/来源/标签/创建时间）
- [ ] `export_data` 支持 `format=xlsx` 和 `format=csv` 两种输出
- [ ] 导出字段顺序严格与 `fieldOrder` 一致（可通过调整顺序后导出验证）
- [ ] `scope=all` 导出所有未删除候选人
- [ ] `scope=job` 仅导出指定职位关联的候选人
- [ ] `scope=filtered` 正确应用前端传入的筛选条件
- [ ] 导出文件可在 Excel/WPS 中正常打开，无乱码
- [ ] 未勾选任何字段时「确认导出」按钮禁用，并提示「至少选择一个字段」

### 5.3 Step 23 - 数据备份与恢复
- [ ] `export_backup` 生成的 zip 包含 `talent.db` 和 `res/candidates/` 下的所有文件
- [ ] zip 文件可通过系统解压工具正常解压
- [ ] `import_backup` 在解压前自动创建 `.bak` 文件和 `res.bak/` 目录
- [ ] 导入损坏的 zip 文件时，Rust 返回明确错误，**不覆盖**当前数据
- [ ] 恢复异常后，调用 `rollback_backup` 能成功恢复到恢复前的状态
- [ ] 系统只保留最近 3 个 `.bak`，旧的自动清理
- [ ] 前端进度条在备份过程中实时更新（0% → 100%）
- [ ] 恢复成功后前端提示「请重启应用」，并提供重启按钮

### 5.4 Step 25 - 职位模板完善 + 流程模板
- [ ] 数据库迁移 V4 成功执行，`pipeline_templates` 表创建成功
- [ ] 在职位创建页选择流程模板后，发布职位自动创建对应阶段
- [ ] 阶段顺序与模板中 `stages_json` 定义的 `sort_order` 一致
- [ ] 职位详情页「流程配置」Tab 可将当前阶段保存为模板
- [ ] 保存的流程模板可在新建职位时下拉选择
- [ ] 删除流程模板不影响已使用该模板的职位
- [ ] 流程模板列表按创建时间倒序排列

### 5.5 通用验收
- [ ] api.ts 中所有新增 API（stats/export/backup/pipelineTemplates）均有 TypeScript 类型定义
- [ ] 所有新增 Rust commands 使用 `DbPool` 获取连接，不使用裸 Connection
- [ ] 所有新增 Rust commands 的输入参数使用 `validate.rs` 中的 Input struct 校验
- [ ] 所有 ERROR 级别异常记录到 `logs/talent-vault-{date}.log`

---

## 6. 待确认问题

1. **导出实现位置**：`export_data` 推荐在 Rust 端用 `xlsx` crate 生成文件，但需确认是否引入新的 Rust 依赖。若团队倾向前端 SheetJS 生成，需调整 API 返回数据格式（返回二进制数据而非文件路径）。
2. **进度事件通道**：Tauri 2 的事件通道（Channel）API 是否已在前端封装？若未封装，备份进度条可降级为「开始/完成」两态提示。
3. **Step 24 智能解析**：本次 Phase 3 是否明确跳过 Step 24？建议在 Phase 3 结束后再评估是否加入后续迭代。
4. **导出范围「当前筛选结果」**：需要前端将候选人列表页的 filter state 传递到导出弹窗，是否通过 URL query params 共享状态，还是通过 Zustand store？
5. **ECharts 主题**：是否已配置暗色主题？若没有，需在 Step 21 前端实现时一并配置 ECharts 暗色主题（文字色 `#e2e8f0`，网格线 `#2a2d35`）。

---

## 附录：Phase 3 接口汇总

### 新增/完善的后端 Commands

| Command | 文件 | 类型 | 说明 |
|---|---|---|---|
| `get_funnel_data` | `talent_pool.rs` | 新增 | 漏斗数据统计 |
| `export_data` | `export.rs` | 新增 | 动态字段导出 |
| `get_exportable_fields` | `export.rs` | 新增 | 获取可导出字段元数据 |
| `export_backup` | `backup.rs` | 重写 | Rust 端异步 zip 打包 |
| `import_backup` | `backup.rs` | 重写 | 安全恢复（含 .bak） |
| `rollback_backup` | `backup.rs` | 新增 | 从 .bak 回滚 |
| `list_pipeline_templates` | `pipeline.rs` / 新建 | 新增 | 流程模板列表 |
| `create_pipeline_template` | `pipeline.rs` / 新建 | 新增 | 创建流程模板 |
| `delete_pipeline_template` | `pipeline.rs` / 新建 | 新增 | 删除流程模板 |

### 新增的前端组件

| 组件 | 路径 | 说明 |
|---|---|---|
| `ExportConfig.tsx` | `src/components/settings/ExportConfig.tsx` | 导出配置弹窗 |
| `BackupRestore.tsx` | `src/components/settings/BackupRestore.tsx` | 备份恢复 UI（重构现有） |

### 新增的数据库迁移

| 迁移文件 | 说明 |
|---|---|
| `V4__pipeline_templates.sql` | 创建 pipeline_templates 表 |
