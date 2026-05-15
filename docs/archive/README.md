# 拾才 TalentVault — V1.0 归档摘要

> **归档日期：** 2026-05-16
> **版本：** v1.0.0
> **状态：** Phase 1 + 2 + 3 核心功能开发完成
> **GitHub 仓库：** https://github.com/shixianzhangyue/shicai

---

## 一、V1.0 功能范围

### 已实现模块（Phase 1-3）

| 模块 | 功能点 | 状态 |
|------|--------|------|
| 全局布局 + 路由 | 侧边栏导航、暗色主题、页面路由 | ✅ |
| 标签管理 | CRUD、颜色选择、引用计数 | ✅ |
| 职位管理 | CRUD、软删除、状态流转、复制、模板 | ✅ |
| 候选人管理 | CRUD、软删除、简历上传/预览、查重 | ✅ |
| 流程阶段配置 | 自定义阶段、拖拽排序、默认模板 | ✅ |
| 看板视图 | 拖拽流转、防抖优化、乐观更新 | ✅ |
| 列表视图 | 筛选、状态流转、批量操作 | ✅ |
| 人才库 | 淘汰/激活、筛选、快速记录 | ✅ |
| 跟进记录 | 增删、类型/结果、待跟进提醒 | ✅ |
| 候选人关系网络 | 关系增删、展示 | ✅ |
| 仪表盘 | 统计卡片、漏斗堆叠柱状图 | ✅ |
| 数据导出 | 字段勾选、拖拽排序、xlsx/csv | ✅ |
| 数据备份恢复 | Rust 端 zip 打包、.bak 自动回滚 | ✅ |
| 流程模板 | 保存/复用阶段配置 | ✅ |
| LLM 配置 | Step 24 框架已就位，待接入 API | ⏳ |

### Step 完成状态

| Step | 内容 | 状态 |
|-------|------|------|
| 1-4 | 初始化、数据库、布局、标签 | ✅ |
| 5 | 职位 CRUD（含软删除） | ✅ |
| 6 | 职位模板 | ✅ |
| 7-8 | 候选人 CRUD + 搜索筛选 | ✅ |
| 9-11 | 流程阶段、列表视图、看板 | ✅ |
| 12-14 | 人才库、跟进记录、快速记录 | ✅ |
| 15-20 | 关系网络、待跟进、批量操作、简历预览、批量导入、人才画像 | ✅ |
| 21 | 仪表盘 | ✅ |
| 22 | 数据导出 | ✅ |
| 23 | 数据备份恢复 | ✅ |
| 24 | 智能简历解析 | ⏳ 框架已就位，待完成 |
| 25 | 流程模板 | ✅ |

---

## 二、技术栈

| 层级 | 选型 | 版本 |
|------|------|------|
| 桌面框架 | Tauri 2 | 2.11.1 |
| 前端框架 | React 18 + TypeScript | 18.3.1 |
| 样式 | Tailwind CSS 3 | 3.4.10 |
| UI 组件 | shadcn/ui | — |
| 状态管理 | Zustand | 5.0.3 |
| 图表 | ECharts | 5.5.0 |
| 数据库 | SQLite (rusqlite) | 0.32 |
| 连接池 | r2d2_sqlite | 0.25 |
| 数据库迁移 | refinery | 0.8 |
| 文件压缩 | zip (Rust) | 2.2 |
| 输入校验 | validator (Rust) | 0.18 |
| 日志 | log + simplelog (Rust) | — |
| PDF 预览 | react-pdf | 9.1.0 |
| Excel | xlsx (SheetJS) | 0.18.5 |
| 拖拽 | @dnd-kit | 6.x |
| 日历 | @fullcalendar/react | 6.1.15 |
| 构建 | Vite 6 | 6.3.0 |
| 包管理 | pnpm | 9.15.4 |

---

## 三、数据库迁移版本

| 版本 | 文件 | 说明 |
|-------|------|------|
| V1 | `V1__init.sql` | 初始建表（jobs, candidates, resumes, pipeline_stages, candidate_pipeline, follow_ups, candidate_relations, tags） |
| V2 | `V2__add_export_fields.sql` | 导出字段配置表 |
| V3 | `V3__add_backups.sql` | 备份记录表 |
| V4 | `V4__pipeline_templates.sql` | 流程模板表 |
| V5 | `V5__add_llm_configs.sql` | LLM 配置表（Step 24） |

---

## 四、已知问题

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | `cargo check` 在 Windows (Rust 1.95.0 + Tauri 2.11.1) 触发 `STATUS_ACCESS_VIOLATION` | 本地 Rust 编译失败，需依赖 Linux/macOS 或 GitHub Actions 构建 | 已知限制 |
| 2 | CI Run #7、#8 均失败 | 自动构建流水线未生效 | 待修复 |
| 3 | pnpm-workspace.yaml 缺少 `packages` 字段 | 已在 #8 提交中修复（添加 `packages: ["."]`） | 已修复，待验证 |
| 4 | 导出范围 `filtered` 在前端 UI 未暴露 | 后端支持但用户无法使用 | 非阻塞，延后处理 |

---

## 五、归档文件结构

```
talent-vault/
├── README.md                          # 项目说明（已更新 V1.0）
├── docs/
│   ├── SPEC-v1.0.md                 # 完整开发规格书（由 SPEC-v4-revised.md 归档）
│   ├── phase3-arch.md               # Phase 3 增量架构设计
│   ├── phase3-prd.md               # Phase 3 PRD
│   ├── phase3-qa-report.md          # Phase 3 QA 报告
│   ├── class-diagram.mermaid       # 最新类图
│   ├── sequence-diagram.mermaid    # 最新时序图
│   └── archive/
│       ├── steps/                  # Step 级别中间文档
│       │   ├── ARCH-Step5.md
│       │   ├── ARCH-step24.md
│       │   ├── PRD-Step5.md
│       │   ├── PRD-step24.md
│       │   ├── QA-Step5.md
│       │   ├── QA-step24.md
│       │   ├── class-diagram-step24.mermaid
│       │   └── sequence-diagram-step24.mermaid
│       └── README.md               # 归档索引（本文件）
├── src/                              # 前端源码
├── src-tauri/                        # Rust 后端
│   ├── src/
│   │   ├── commands/               # Tauri 命令（15 个模块）
│   │   ├── db/                   # 数据库 + 迁移
│   │   ├── services/
│   │   ├── logger.rs
│   │   ├── validate.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI 流水线（待修复）
│       └── release.yml            # Release 流水线（待修复）
└── package.json
```

---

## 六、下一步计划

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | 修复 CI 流水线 | 确保 `pnpm install` + `cargo check` + `tauri build` 通过 |
| P0 | 完成 Step 24 智能简历解析 | 接入 LLM API，实现简历 → 结构化数据 |
| P1 | Windows 本地构建方案 | 使用 WSL2 或 GitHub Actions 构建 Windows .msi |
| P1 | 导出 `filtered` 范围 UI | 前端 ExportConfig 补全第三个单选按钮 |
| P2 | 备份定时提醒 | 超过 7 天未备份显示提醒徽标 |

---

## 七、存档记录

| 归档项 | 原路径 | 归档路径 |
|--------|----------|----------|
| 开发规格书 v1.0 | `SPEC-v4-revised.md` | `docs/SPEC-v1.0.md` |
| Step 5 架构文档 | `docs/ARCH-Step5.md` | `docs/archive/steps/ARCH-Step5.md` |
| Step 24 架构文档 | `docs/ARCH-step24.md` | `docs/archive/steps/ARCH-step24.md` |
| Step 5 PRD | `docs/PRD-Step5.md` | `docs/archive/steps/PRD-Step5.md` |
| Step 24 PRD | `docs/PRD-step24.md` | `docs/archive/steps/PRD-step24.md` |
| Step 5 QA 报告 | `docs/QA-Step5.md` | `docs/archive/steps/QA-Step5.md` |
| Step 24 QA 报告 | `docs/QA-step24.md` | `docs/archive/steps/QA-step24.md` |
| Step 24 类图 | `docs/class-diagram-step24.mermaid` | `docs/archive/steps/` |
| Step 24 时序图 | `docs/sequence-diagram-step24.mermaid` | `docs/archive/steps/` |

---

*归档人：咚仔（AI 助手）| 归档日期：2026-05-16*
