# TalentVault · 本地招聘管理系统

> **版本：** 0.1.0  
> **定位：** Windows / macOS / Linux 本地运行的个人招聘管理工具，以人才库管理为核心，猎头工作流驱动  
> **技术栈：** Tauri 2 + React 18 + TypeScript + SQLite  
> **包体：** ~5MB（Tauri 桌面端）

---

## 功能概览

TalentVault 是一款面向招聘专员和猎头的本地桌面应用，所有数据存储在本地 SQLite 数据库中，无需联网即可使用，同时支持接入 LLM API 实现简历智能解析。

| 模块 | 功能 |
|------|------|
| **人才库** | 候选人列表、详情、新增/编辑、标签管理、附件管理、简历预览 |
| **职位管理** | 职位列表、新建/编辑、流程阶段配置（看板）、职位模板 |
| **招聘流程** | 拖拽式看板、候选人投递追踪、面试日程 |
| **仪表盘** | 数据统计、漏斗分析、ECharts 可视化图表 |
| **设置** | LLM 配置（智能解析）、数据导出（Excel）、备份恢复、流程模板 |

### 核心亮点

- **全本地运行**：数据存储在本地 SQLite，无需注册账号，无需联网
- **AI 智能解析**：接入 OpenAI / 百度 ERNIE / 通义千问 / 讯飞星火等 LLM，上传简历自动提取结构化信息
- **拖拽看板**：类似 Trello 的招聘流程看板，直观管理候选人状态
- **Excel 导出**：支持字段勾选、拖拽排序、自定义导出格式
- **备份恢复**：一键备份/恢复，支持 .bak 回滚机制
- **暗色主题**：参考 Linear / Raycast 风格的暗色 UI

---

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 前端构建 |
| pnpm | >= 8 | 包管理（推荐） |
| Rust | >= 1.75 | Tauri 后端编译 |
| Tauri CLI | >= 2.0 | 桌面应用构建 |

### 系统支持

- **Windows** 10/11
- **macOS** 12+
- **Linux**（需要 WebKitGTK）

---

## 快速开始

### 1. 克隆项目

```bash
git clone <仓库地址>
cd talent-vault
```

### 2. 安装前端依赖

```bash
pnpm install
```

### 3. 开发模式运行

```bash
pnpm tauri dev
```

这将同时启动前端开发服务器和 Rust 后端。

### 4. 生产构建

```bash
pnpm tauri build
```

构建产物：
- **Windows**: `src-tauri/target/release/talent-vault.exe`
- **macOS**: `src-tauri/target/release/bundle/macos/TalentVault.app`
- **Linux**: `src-tauri/target/release/bundle/deb/*.deb`

---

## 项目结构

```
talent-vault/
├── src/                          # 前端 React 源码
│   ├── components/               # UI 组件
│   │   ├── candidates/           # 候选人相关组件
│   │   ├── jobs/                 # 职位相关组件
│   │   ├── pipeline/             # 流程看板组件
│   │   ├── settings/             # 设置页面组件
│   │   └── ui/                   # shadcn/ui 基础组件
│   ├── hooks/                    # 自定义 React Hooks
│   ├── lib/                      # 工具库
│   │   ├── api.ts                # Tauri 命令调用封装
│   │   └── utils.ts              # 工具函数
│   ├── pages/                    # 页面级组件
│   ├── stores/                   # Zustand 状态管理
│   ├── types/                    # TypeScript 类型定义
│   └── App.tsx                   # 应用入口
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── commands/             # Tauri 命令处理器
│   │   ├── db/                   # 数据库连接与迁移
│   │   ├── services/             # 业务服务层
│   │   └── lib.rs                # Tauri 入口
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
├── public/                       # 静态资源
├── docs/                         # 项目文档（PRD、架构、QA报告）
└── package.json                  # 前端依赖
```

---

## 数据库

TalentVault 使用 SQLite 作为本地数据库，通过 `refinery` 管理迁移。

### 现有表结构

| 表名 | 说明 |
|------|------|
| `jobs` | 职位信息 |
| `candidates` | 候选人信息 |
| `tags` | 标签 |
| `candidate_tags` | 候选人-标签关联 |
| `pipeline_stages` | 流程阶段 |
| `pipeline_templates` | 流程模板 |
| `llm_configs` | LLM 配置（Step 24 新增）|

### 迁移脚本

迁移文件位于 `src-tauri/src/db/migrations/`：

| 版本 | 文件 | 说明 |
|------|------|------|
| V1 | `V1__init.sql` | 初始表结构 |
| V2 | `V2__add_export_fields.sql` | 导出字段表 |
| V3 | `V3__add_backups.sql` | 备份表 |
| V4 | `V4__pipeline_templates.sql` | 流程模板表 |
| V5 | `V5__add_llm_configs.sql` | LLM 配置表（Step 24）|

数据库文件默认存储在系统应用数据目录：
- **Windows**: `%APPDATA%/com.talent-vault.app/db.sqlite`
- **macOS**: `~/Library/Application Support/com.talent-vault.app/db.sqlite`
- **Linux**: `~/.local/share/com.talent-vault.app/db.sqlite`

---

## 开发指南

### 前端开发

```bash
# 单独启动前端开发服务器（用于快速迭代 UI）
pnpm dev

# 代码格式化
pnpm format

# TypeScript 类型检查
npx tsc --noEmit
```

### 后端开发

```bash
# 进入 Rust 项目目录
cd src-tauri

# 检查 Rust 代码（不编译）
cargo check

# 运行测试
cargo test

# 格式化代码
cargo fmt
```

### 添加新的 Tauri 命令

1. 在 `src-tauri/src/commands/` 下创建新的 `.rs` 文件
2. 在 `src-tauri/src/commands/mod.rs` 中声明模块
3. 在 `src-tauri/src/lib.rs` 的 `invoke_handler![]` 中注册命令
4. 在 `src/lib/api.ts` 中添加前端调用封装
5. 在 `src/types/index.ts` 中添加类型定义（如有新类型）

---

## 打包发布

### 前提条件

- 前端构建通过：`pnpm run build`
- Rust 编译通过：`cd src-tauri && cargo check`

### Windows 打包

```bash
pnpm tauri build
```

产物位于：`src-tauri/target/release/bundle/msi/TalentVault_0.1.0_x64_en-US.msi`

### macOS 打包

```bash
pnpm tauri build --target universal-apple-darwin
```

产物位于：`src-tauri/target/release/bundle/dmg/TalentVault_0.1.0_universal.dmg`

### Linux 打包

```bash
pnpm tauri build
```

产物位于：`src-tauri/target/release/bundle/deb/talent-vault_0.1.0_amd64.deb`

---

## 技术栈详情

| 层级 | 选型 | 说明 |
|------|------|------|
| 桌面框架 | Tauri 2 | Rust 后端 + 系统 WebView |
| 前端框架 | React 18 + TypeScript | 函数组件 + Hooks |
| UI 组件库 | shadcn/ui | 基于 Radix UI，代码可复制到项目内 |
| 样式 | Tailwind CSS 3 | 原子化 CSS |
| 状态管理 | Zustand | 轻量，无 Provider 包裹 |
| 数据库 | SQLite (rusqlite) | 本地持久化存储 |
| 连接池 | r2d2_sqlite | 并发安全连接池 |
| 数据库迁移 | refinery | 版本化迁移管理 |
| HTTP 客户端 | reqwest | Rust 异步 HTTP |
| 图表 | ECharts | 仪表盘数据可视化 |
| Excel | SheetJS (xlsx) | 数据导入导出 |
| PDF 预览 | react-pdf | 简历预览 |
| 拖拽 | @dnd-kit/core + sortable | 看板拖拽、导出字段排序 |
| 构建工具 | Vite 5 | 前端构建 |
| 包管理 | pnpm | 快速、节省磁盘 |

---

## 常见问题

### Q: Rust 编译失败（STATUS_ACCESS_VIOLATION）？

这是 Windows 环境下 Rust 工具链与 Tauri build script 的已知兼容性问题。建议在以下环境编译：
- WSL2 (Windows Subsystem for Linux)
- macOS 或 Linux 实体机
- GitHub Actions CI（Linux runner）

### Q: LLM 智能解析不工作？

1. 在设置页「LLM 配置」Tab 中配置 API Key
2. 支持的 Provider：OpenAI、百度 ERNIE、通义千问、讯飞星火、自定义（OpenAI 兼容格式）
3. 点击「测试连接」确认配置可用
4. 仅支持文本型 PDF / DOCX / TXT，图片型 PDF 暂不支持

### Q: 如何迁移数据库？

应用启动时会自动运行 `refinery` 迁移脚本，无需手动操作。

---

## 许可证

MIT License

---

## 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [shadcn/ui](https://ui.shadcn.com/) - 可复用的 React 组件库
- [ECharts](https://echarts.apache.org/) - 数据可视化
- [SheetJS](https://sheetjs.com/) - Excel 处理
