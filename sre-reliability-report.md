# TalentVault SRE 可靠性评估报告

**评估人**: Rex (SRE Engineer)
**评估日期**: 2025-05-22
**项目**: TalentVault - 本地招聘管理系统
**技术栈**: Tauri v2 + React/TS 前端 + Rust 后端 + SQLite

---

## 总体 SEV 评级: SEV3 (次要功能风险)

当前项目在可靠性方面**基本合格**，核心数据操作有完整的错误处理链路，备份/恢复机制已实现。但存在若干中等风险点需要改进，主要是前端缺少错误边界、日志级别配置可优化、缺乏自动备份机制。

---

## 一、错误处理分析

### 1.1 Rust 后端错误传播 ✅ 良好

**评级**: 良好

后端所有 Tauri command 统一使用 `Result<T, String>` 返回类型，错误传播链路清晰：

```rust
// 典型模式（所有 commands 文件一致）
let conn = state.get().map_err(|e| {
    let msg = format!("Failed to get database connection: {}", e);
    log::error!("{}", msg);
    msg
})?;
```

**优点**:
- 每个数据库操作都有对应的 `.map_err()` 错误转换
- 所有错误都会通过 `log::error!()` 记录到日志
- 使用 `?` 操作符进行错误传播，避免了 `unwrap()` 的滥用
- LLM 客户端使用 `thiserror` 定义了结构化的 `LlmError` 枚举

**风险点**:
- ⚠️ `lib.rs:178` 使用 `.expect("error while running tauri application")` 会导致应用崩溃而非优雅降级
- ⚠️ `lib.rs:18` 使用 `.expect("no main window")` 在窗口未创建时会 panic
- ⚠️ 所有错误统一为 `String` 类型，缺乏结构化的错误码体系，前端无法根据错误类型做差异化处理

### 1.2 前端错误处理 ⚠️ 需改进

**评级**: 需改进

**优点**:
- `api.ts` 中的 `handleError()` 函数统一处理错误消息提取
- 各页面的 `try/catch` 块覆盖了主要的 API 调用

**风险点**:
- ❌ **缺少 React Error Boundary**: `App.tsx` 和 `main.tsx` 没有全局错误边界，任何未捕获的 React 渲染错误会导致整个应用白屏
- ⚠️ 错误处理仅使用 `console.error()`，未向用户展示友好的错误提示
- ⚠️ 没有统一的 toast/notification 机制来显示操作结果
- ⚠️ `handleError()` 定义了但未在页面组件中使用（页面直接用 `console.error`）

### 1.3 输入验证 ✅ 良好

**评级**: 良好

```rust
// validate.rs 使用 validator crate
#[validate(length(min = 1, max = 100, message = "姓名不能为空且不超过100字符"))]
pub name: String,
#[validate(range(min = 0, max = 50, message = "工作年限应在 0-50 之间"))]
pub years_exp: Option<i32>,
```

- 使用 `validator` crate 进行声明式验证
- 验证消息使用中文，对用户友好
- 覆盖了 Job 和 Candidate 的创建/更新输入

---

## 二、日志记录分析

### 2.1 日志基础设施 ⚠️ 需改进

**评级**: 需改进

```rust
// logger.rs
TermLogger::new(LevelFilter::Info, ...)      // 终端: Info 及以上
WriteLogger::new(LevelFilter::Info, ...)      // 文件: Info 及以上
```

**优点**:
- 使用 `simplelog` crate 实现了文件 + 终端双输出
- 日志文件按日期命名: `talent-vault-{YYYY-MM-DD}.log`
- 使用 RFC3339 时间格式
- 应用启动时先初始化 logger 再执行后续操作

**风险点**:
- ⚠️ **日志级别**: 文件输出级别为 `Info`，生产环境建议改为 `Warn` 或 `Error` 以减少日志量
- ⚠️ **无日志轮转**: 日志文件按天生成但无自动清理机制，长期运行会导致磁盘空间耗尽
- ⚠️ **无结构化日志**: 使用纯文本格式，不利于日志聚合和分析
- ⚠️ **敏感信息**: LLM API 错误可能包含 API key 片段（如 HTTP 401 响应体）

### 2.2 操作审计 ✅ 良好

**评级**: 良好

```rust
// candidates.rs - 删除操作有审计日志
conn.execute(
    "INSERT INTO audit_logs (id, table_name, record_id, action, old_data, performed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    params![&audit_id, "candidates", &id, "soft_delete", &old_data, &now],
)?;
```

- 删除操作记录到 `audit_logs` 表
- 保存了完整的旧数据快照（`old_data`）
- 使用软删除 (`deleted_at`) 而非物理删除

---

## 三、崩溃恢复分析

### 3.1 Tauri v2 Windows 兼容性 ⚠️ 需关注

**评级**: 需关注

**风险点**:
- ⚠️ 项目使用 Tauri v2，已知在 Windows 上存在 `STATUS_ACCESS_VIOLATION` 问题（WebView2 内核崩溃）
- ⚠️ `main.rs` 中 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` 会隐藏 release 模式的控制台，崩溃时无日志输出
- ⚠️ 应用未实现崩溃恢复钩子（如 `std::panic::set_hook`）

### 3.2 数据库一致性 ✅ 良好

**评级**: 良好

```rust
// pool.rs - SQLite 单连接池，避免写冲突
Pool::builder()
    .max_size(1)  // SQLite 序列化写入
    .build(manager)
```

**优点**:
- 连接池 `max_size=1` 避免了 SQLite 的 "database is locked" 错误
- 使用 `refinery` 进行数据库迁移，支持版本管理
- 迁移失败时自动尝试重置（`DROP TABLE IF EXISTS refinery_schema_history`）
- 所有写操作使用事务性 SQL（虽然未显式使用 `BEGIN/COMMIT`，但 SQLite 默认 autocommit 模式下每条语句是原子的）

**风险点**:
- ⚠️ `batch_move` 和 `batch_reject` 使用循环逐条更新，未使用显式事务，中途失败会导致部分更新
- ⚠️ `import_backup` 在覆盖数据库前创建了 `.bak` 文件，但如果覆盖过程中断电，可能导致数据库损坏

### 3.3 备份/恢复机制 ✅ 良好

**评级**: 良好

```rust
// backup.rs - 完整的备份/恢复/回滚机制
pub fn export_backup(...)   // 导出为 zip
pub fn import_backup(...)   // 导入并创建回滚点
pub fn rollback_backup(...) // 回滚到最近备份
```

**优点**:
- 导出时打包数据库 + 资源文件为 zip
- 导入前自动创建回滚备份（`.bak` 文件）
- 自动清理旧备份（保留最近 3 份）
- 支持 OneDrive 云端同步备份

**风险点**:
- ❌ **无自动备份**: 备份完全依赖用户手动触发，无定时自动备份
- ⚠️ 备份过程未校验数据库完整性（如 `PRAGMA integrity_check`）
- ⚠️ 导入时未验证备份文件的版本兼容性

---

## 四、性能监控分析

### 4.1 当前状态 ❌ 缺失

**评级**: 缺失

**缺失项**:
- ❌ 无请求响应时间监控
- ❌ 无内存使用监控
- ❌ 无 CPU 占用监控
- ❌ 无数据库查询性能监控
- ❌ 无崩溃报告机制

### 4.2 潜在性能风险

- ⚠️ SQLite 单连接池在高并发场景下可能成为瓶颈
- ⚠️ 大量候选人查询时的 `LIKE` 模糊搜索可能较慢
- ⚠️ LLM API 调用超时设置为 30 秒，但无重试机制
- ⚠️ OneDrive 文件上传/下载使用同步阻塞方式

---

## 五、改进建议（按优先级排序）

### P0 - 必须立即修复

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 1 | 前端缺少 Error Boundary | 任何 React 渲染错误导致白屏 | 在 `App.tsx` 外层包裹全局 Error Boundary，显示友好的错误页面和"重新加载"按钮 |
| 2 | `lib.rs` 中的 `expect()` 调用 | 应用启动失败时直接崩溃 | 改用 `match` 或 `if let` 处理，显示错误对话框后优雅退出 |
| 3 | 批量操作无事务保护 | 部分更新导致数据不一致 | 在 `batch_move`/`batch_reject` 中使用 `conn.execute("BEGIN")` 和 `COMMIT/ROLLBACK` |

### P1 - 重要改进

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 4 | 无自动备份机制 | 数据丢失风险 | 实现定时备份（如每天启动时自动备份），或在重大操作前自动创建快照 |
| 5 | 无日志轮转 | 磁盘空间耗尽 | 添加日志文件大小限制和自动清理（如保留最近 30 天） |
| 6 | 无崩溃恢复钩子 | Windows WebView2 崩溃时数据丢失 | 实现 `std::panic::set_hook`，在崩溃前保存状态 |
| 7 | 前端错误提示不友好 | 用户不知道发生了什么 | 实现全局 toast 通知系统，API 错误自动显示用户友好的消息 |

### P2 - 建议改进

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 8 | 缺乏结构化错误码 | 前端无法差异化处理错误 | 定义错误码枚举，前端根据错误码显示不同提示 |
| 9 | 无性能监控 | 无法发现性能瓶颈 | 添加关键操作的执行时间日志，定期分析慢查询 |
| 10 | LLM API 无重试机制 | 网络抖动导致操作失败 | 实现指数退避重试（最多 3 次） |
| 11 | 备份未校验完整性 | 恢复损坏的备份 | 导出前执行 `PRAGMA integrity_check`，导入后再次校验 |
| 12 | 敏感信息可能泄露 | API key 出现在日志中 | 对日志中的敏感信息进行脱敏处理 |

---

## 六、风险矩阵

| 风险 | 概率 | 影响 | 等级 | 缓解措施 |
|------|------|------|------|----------|
| React 渲染错误导致白屏 | 中 | 高 | **高** | 实现 Error Boundary |
| 批量操作部分失败 | 低 | 高 | **高** | 显式事务 |
| 用户从未备份导致数据丢失 | 高 | 高 | **高** | 自动备份 |
| Windows WebView2 崩溃 | 低 | 高 | **中** | 崩溃恢复钩子 |
| 日志磁盘空间耗尽 | 中 | 中 | **中** | 日志轮转 |
| LLM API 超时 | 中 | 低 | **低** | 重试机制 |

---

## 七、已有的良好实践

尽管存在上述改进空间，项目在可靠性方面已有不少良好实践：

1. ✅ **统一的错误处理模式**: 所有 command 使用一致的 `Result<T, String>` + `log::error!()` 模式
2. ✅ **输入验证**: 使用 `validator` crate 进行声明式验证
3. ✅ **软删除**: 使用 `deleted_at` 而非物理删除，保护数据
4. ✅ **审计日志**: 删除操作记录完整的旧数据快照
5. ✅ **备份/恢复/回滚**: 完整的三段式数据保护机制
6. ✅ **SQLite 单连接池**: 避免了写冲突问题
7. ✅ **数据库迁移**: 使用 `refinery` 管理 schema 版本
8. ✅ **LLM 错误分类**: 使用 `thiserror` 定义结构化错误类型
9. ✅ **API key 混淆**: 使用 XOR + Base64 存储 API key（虽非加密，但避免明文存储）

---

## 八、总结

TalentVault 的可靠性基础设施**基本可用**，核心数据操作有完整的错误处理和日志记录。主要风险集中在：

1. **前端错误边界缺失** — 最高优先级，任何渲染错误都会导致白屏
2. **缺乏自动备份** — 用户数据保护依赖手动操作
3. **批量操作无事务** — 数据一致性风险

建议按 P0 > P1 > P2 的顺序逐步改进，预计 P0 项可在 1-2 天内完成。

---

*Report generated by Rex (SRE Engineer) on 2025-05-22*
