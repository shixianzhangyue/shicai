# TalentVault 测试覆盖分析报告

**测试专家**: 泰莎 (Tessa)
**分析日期**: 2026-05-22
**项目**: TalentVault - 本地招聘管理系统
**技术栈**: Tauri v2 + React/TypeScript 前端 + Rust 后端 + SQLite

---

## 一、测试现状总评

### 总体评分：🔴 严重缺失 (Critical)

| 维度 | 评级 | 说明 |
|------|------|------|
| 单元测试 | 🔴 极低 | 仅 Rust 后端 1 个文件有 5 个测试用例 |
| 集成测试 | 🔴 零 | 完全没有集成测试 |
| E2E 测试 | 🔴 零 | 完全没有 E2E 测试 |
| CI/CD 测试 | 🔴 无 | CI 仅做编译检查，无测试执行 |
| 测试工具 | 🔴 未配置 | 前后端均无测试框架依赖 |

### 关键发现

1. **唯一存在的测试**: `src-tauri/src/services/text_parser.rs` 中的 `#[cfg(test)]` 模块，包含 5 个基础正则提取测试
2. **零前端测试**: 无任何 `*.test.tsx` 或 `*.spec.ts` 文件
3. **零测试目录**: 无 `tests/` 目录
4. **CI 不跑测试**: `ci.yml` 和 `release.yml` 仅执行 `cargo check` 和 `tsc --noEmit`
5. **package.json 无 test 脚本**: 缺少 `"test": "..."` 配置
6. **Cargo.toml 无测试依赖**: 缺少 mockall、proptest 等测试库

---

## 二、测试覆盖缺口分析

### 2.1 Rust 后端 — 高风险未测试区域

| 模块 | 文件 | 风险等级 | 复杂度 | 当前测试 |
|------|------|----------|--------|----------|
| **候选人 CRUD** | `commands/candidates.rs` | 🔴 极高 | 动态 SQL 构建、分页、20+ 过滤条件 | ❌ 无 |
| **重复检测** | `services/duplicate_detector.rs` | 🔴 极高 | O(n²) 比对、Jaccard 相似度、合并逻辑 | ❌ 无 |
| **备份恢复** | `commands/backup.rs` | 🔴 极高 | ZIP 打包/解包、回滚、清理旧备份 | ❌ 无 |
| **流水线管理** | `commands/pipeline.rs` | 🟠 高 | 状态流转、批量操作、排序 | ❌ 无 |
| **LLM 客户端** | `services/llm_client.rs` | 🟠 高 | HTTP 调用、JSON 解析、字段合并、Key 混淆 | ❌ 无 |
| **文本提取** | `services/text_extractor.rs` | 🟠 高 | PDF/DOCX/TXT/图片多格式支持 | ❌ 无 |
| **输入验证** | `validate.rs` | 🟡 中 | validator crate 验证规则 | ❌ 无 |
| **简历正则解析** | `services/text_parser.rs` | 🟡 中 | 12 个正则提取函数 | ✅ 5 个基础测试 |
| **数据库迁移** | `db/migrations.rs` | 🟡 中 | checksum 不匹配自动重置 | ❌ 无 |
| **分析统计** | `commands/analytics.rs` | 🟡 中 | 聚合查询 | ❌ 无 |
| **导出功能** | `commands/export.rs` | 🟡 中 | 字段映射、CSV/XLSX 格式 | ❌ 无 |

### 2.2 React/TypeScript 前端 — 高风险未测试区域

| 模块 | 文件 | 风险等级 | 复杂度 | 当前测试 |
|------|------|----------|--------|----------|
| **API 映射层** | `lib/api.ts` | 🔴 极高 | 40+ 命令映射、camelCase↔snake_case 转换 | ❌ 无 |
| **候选人 Store** | `stores/candidateStore.ts` | 🟠 高 | 搜索索引、分页、过滤 | ❌ 无 |
| **Pipeline Store** | `stores/pipelineStore.ts` | 🟠 高 | 状态管理、阶段流转 | ❌ 无 |
| **Zustand 状态管理** | `stores/*.ts` (7 个) | 🟠 高 | 跨 Store 状态同步 | ❌ 无 |
| **自定义 Hooks** | `hooks/*.ts` (5 个) | 🟡 中 | useCandidates, useJobs, usePipeline 等 | ❌ 无 |
| **表单组件** | `components/candidates/CandidateForm.tsx` | 🟡 中 | 复杂表单验证 | ❌ 无 |
| **看板拖拽** | `components/pipeline/KanbanBoard.tsx` | 🟡 中 | DnD 交互 | ❌ 无 |
| **仪表盘** | `components/dashboard/Dashboard.tsx` | 🟡 中 | 图表渲染 | ❌ 无 |

---

## 三、推荐测试策略

### 3.1 测试金字塔

```
        /  E2E  \         5-10 个关键路径 (Playwright)
       / 集成测试 \       20-30 个 API 集成测试 (Rust + Vitest)
      /   单元测试  \     100+ 个纯逻辑测试 (Rust #[test] + Vitest)
```

### 3.2 工具选型

| 层级 | Rust 后端 | React 前端 |
|------|-----------|------------|
| 单元测试 | `#[cfg(test)]` + `cargo test` | Vitest + React Testing Library |
| 集成测试 | `#[test]` + 内存 SQLite | Vitest + MSW (Mock Tauri invoke) |
| E2E 测试 | — | Playwright (Tauri WebDriver) |
| 属性测试 | `proptest` (正则解析) | — |
| Mock 框架 | `mockall` (HTTP 客户端) | `vi.fn()` / `vi.mock()` |
| 覆盖率 | `cargo-tarpaulin` | Vitest `--coverage` (c8/v8) |

### 3.3 CI/CD 增强

```yaml
# 建议在 ci.yml 中添加
- name: Run Rust tests
  run: cd src-tauri && cargo test

- name: Run frontend tests
  run: pnpm test -- --run

- name: Coverage report
  run: pnpm test -- --coverage
```

---

## 四、优先级排序的测试改进计划

### P0 — 立即实施（第 1 周）

#### 1. 搭建测试基础设施
- [ ] **前端**: 安装 `vitest`、`@testing-library/react`、`@testing-library/jest-dom`
- [ ] **Rust**: 添加 `[dev-dependencies]` 段（无额外依赖即可跑 `#[test]`）
- [ ] **配置**: 添加 `package.json` 的 `"test": "vitest"` 脚本
- [ ] **CI**: 在 `ci.yml` 中添加 `cargo test` 和 `pnpm test` 步骤

#### 2. 输入验证测试（`validate.rs`）
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_candidate_empty_name_rejected() {
        let input = CreateCandidateInput {
            name: "".to_string(),
            // ...
        };
        assert!(validate_input(&input).is_err());
    }

    #[test]
    fn test_years_exp_out_of_range() {
        let input = CreateCandidateInput {
            name: "张三".to_string(),
            years_exp: Some(51),
            // ...
        };
        assert!(validate_input(&input).is_err());
    }
}
```

#### 3. 正则解析测试扩充（`text_parser.rs`）
现有 5 个测试，需扩充至 ~20 个：
```rust
#[test]
fn test_extract_name_chinese() {
    assert_eq!(extract_name("姓名：张三"), Some("张三".to_string()));
}

#[test]
fn test_extract_name_english() {
    assert_eq!(extract_name("John Doe"), None); // 不应匹配英文名
}

#[test]
fn test_extract_phone_with_prefix() {
    assert_eq!(extract_phone("+86 13812345678"), Some("13812345678".to_string()));
}

#[test]
fn test_parse_resume_full() {
    let text = "姓名：张三\n电话：13812345678\n邮箱：zhangsan@test.com\n学历：本科\n工作经验：5年";
    let result = parse_resume_text_regex(text);
    assert_eq!(result.name, Some("张三".to_string()));
    assert_eq!(result.phone, Some("13812345678".to_string()));
    assert_eq!(result.email, Some("zhangsan@test.com".to_string()));
    assert_eq!(result.education, Some("本科".to_string()));
    assert_eq!(result.years_exp, Some(5));
}
```

### P1 — 短期实施（第 2-3 周）

#### 4. 重复检测单元测试（`duplicate_detector.rs`）
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_phone_with_country_code() {
        assert_eq!(normalize_phone("+8613812345678"), "13812345678");
        assert_eq!(normalize_phone("86-138-1234-5678"), "13812345678");
    }

    #[test]
    fn test_string_similarity_identical() {
        assert_eq!(string_similarity("张三", "张三"), 1.0);
    }

    #[test]
    fn test_string_similarity_different() {
        assert!(string_similarity("张三丰", "张三") > 0.5);
    }
}
```

#### 5. LLM 客户端 Key 混淆测试
```rust
#[test]
fn test_obfuscate_deobfuscate_roundtrip() {
    let key = "sk-abc123def456";
    let obfuscated = obfuscate_key(key);
    let deobfuscated = deobfuscate_key(&obfuscated);
    assert_eq!(deobfuscated, key);
}

#[test]
fn test_obfuscate_key_not_plaintext() {
    let key = "sk-secret-key";
    let obfuscated = obfuscate_key(key);
    assert_ne!(obfuscated, key);
}
```

#### 6. 前端 API 映射测试（`lib/api.ts`）
```typescript
// lib/api.test.ts
import { describe, it, expect } from 'vitest';

describe('mapCreateCandidateInput', () => {
  it('should map camelCase to snake_case', () => {
    const input = {
      name: '张三',
      currentCompany: '腾讯',
      currentPosition: '前端工程师',
      yearsExp: 5,
      tags: ['React', 'TypeScript'],
      source: 'manual' as const,
    };
    const result = mapCreateCandidateInput(input);
    expect(result.current_company).toBe('腾讯');
    expect(result.current_position).toBe('前端工程师');
    expect(result.years_exp).toBe(5);
  });
});
```

#### 7. Zustand Store 测试（候选人 Store）
```typescript
// stores/candidateStore.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useCandidateStore } from './candidateStore';

describe('candidateStore', () => {
  it('should reset filters correctly', () => {
    const store = useCandidateStore.getState();
    store.setFilters({ education: '本科', minExp: 3 });
    store.resetFilters();
    expect(useCandidateStore.getState().filters.education).toBeNull();
    expect(useCandidateStore.getState().filters.minExp).toBeNull();
  });

  it('should reset page on filter change', () => {
    const store = useCandidateStore.getState();
    store.setPage(5);
    store.setFilters({ source: 'referral' });
    expect(useCandidateStore.getState().page).toBe(1);
  });
});
```

### P2 — 中期实施（第 4-6 周）

#### 8. 候选人 CRUD 集成测试（Rust）
- 创建候选人 → 查询 → 更新 → 软删除 → 验证删除后不可见
- 分页边界：page=0, pageSize=0, pageSize=101
- 多条件过滤组合测试
- 排序方向测试（ASC/DESC）

#### 9. Pipeline 状态流转集成测试
- 添加候选人到职位 → 移动阶段 → 拒绝 → 人才池
- 批量操作测试
- 重复添加同一候选人到同一职位

#### 10. 备份恢复集成测试
- 导出 → 导入 → 验证数据一致性
- 回滚测试
- 无效 ZIP 文件处理
- 清理旧备份保留策略

#### 11. 前端组件测试
- CandidateForm 表单验证
- CandidateList 搜索和过滤交互
- KanbanBoard 拖拽交互

### P3 — 长期规划（第 7+ 周）

#### 12. E2E 测试（Playwright）
```
关键路径 E2E 测试清单：
1. 创建候选人完整流程（填写表单 → 保存 → 列表验证）
2. 简历解析流程（上传 PDF → OCR → 预览 → 保存）
3. 招聘流程（创建职位 → 推荐候选人 → 流转阶段 → 录用）
4. 备份恢复流程（导出 → 清空 → 导入 → 验证）
5. 数据导入流程（Excel 上传 → 预览 → 确认 → 列表验证）
```

#### 13. 属性测试（proptest）
```rust
proptest! {
    #[test]
    fn test_phone_extraction_never_panics(text in ".*") {
        let _ = extract_phone(&text);
    }

    #[test]
    fn test_name_extraction_length_bound(text in ".*") {
        if let Some(name) = extract_name(&text) {
            prop_assert!(name.len() >= 2 && name.len() <= 4);
        }
    }
}
```

#### 14. 视觉回归测试
- 关键页面截图对比
- 深色/浅色主题切换

---

## 五、覆盖率目标

| 阶段 | 时间 | Rust 后端 | React 前端 | 整体 |
|------|------|-----------|------------|------|
| P0 完成 | 第 1 周 | 15% → 30% | 0% → 10% | ~15% |
| P1 完成 | 第 3 周 | 30% → 50% | 10% → 30% | ~35% |
| P2 完成 | 第 6 周 | 50% → 70% | 30% → 50% | ~55% |
| P3 完成 | 第 10 周 | 70% → 80% | 50% → 65% | ~70% |

**覆盖率重点**（必须覆盖）：
- ✅ 业务关键路径：候选人 CRUD、Pipeline 状态流转、备份恢复
- ✅ 错误处理：输入验证、数据库错误、网络超时
- ✅ 边界情况：空值、超长输入、分页边界
- ✅ 安全边界：API Key 混淆、SQL 注入防护（参数化查询已使用）
- ✅ 数据完整性：合并候选人的事务性、备份完整性

**覆盖率豁免**（不必追求高覆盖）：
- ❌ UI 原子组件（button.tsx、card.tsx 等 shadcn 组件）
- ❌ Tauri 框架胶水代码（main.rs、lib.rs）
- ❌ 样式文件（index.css）
- ❌ 一次性脚本（start-dev.bat、stop-dev.bat）

---

## 六、测试债务汇总

| 类别 | 数量 | 优先级 | 估计工作量 |
|------|------|--------|-----------|
| Rust 单元测试缺失 | ~15 个模块 | P0-P1 | 3-5 天 |
| 前端单元测试缺失 | ~12 个 Store/Hook | P1 | 2-3 天 |
| 集成测试缺失 | ~8 个关键流程 | P2 | 5-8 天 |
| E2E 测试缺失 | 5 条关键路径 | P3 | 3-5 天 |
| CI/CD 测试配置 | 1 个 | P0 | 0.5 天 |
| 测试框架搭建 | 2 个（前后端） | P0 | 0.5 天 |
| **总计** | | | **14-22 天** |

---

## 七、风险评估

### 最高风险区域（优先测试）

1. **候选人合并逻辑** (`duplicate_detector.rs::merge_candidates`)：涉及多表 UPDATE + 软删除，无事务保护，失败可能导致数据不一致
2. **动态 SQL 构建** (`candidates.rs::list_candidates`)：20+ 过滤条件的手动参数绑定，易出现参数错位
3. **备份导入** (`backup.rs::import_backup`)：直接覆盖文件系统，无完整性校验
4. **API 映射层** (`lib/api.ts`)：camelCase↔snake_case 手动映射，易遗漏字段

### 中等风险区域

5. **LLM 响应解析** (`llm_client.rs::parse_resume`)：依赖外部 API 返回格式，解析链长
6. **Pipeline 批量操作** (`pipeline.rs::batch_move/batch_reject`)：循环内逐条更新，无事务
7. **正则解析** (`text_parser.rs`)：中文正则边界情况多

---

## 八、建议的测试命名规范

### Rust
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_<function_name>_<scenario>() { ... }

    // 示例
    #[test]
    fn test_list_candidates_filters_by_education() { ... }

    #[test]
    fn test_merge_candidates_moves_resumes() { ... }
}
```

### TypeScript
```typescript
describe('<ModuleName>', () => {
  it('should <expected behavior> when <condition>', () => {
    // 示例
    it('should reset page to 1 when filters change', () => { ... });
    it('should throw error when name is empty', () => { ... });
  });
});
```

---

**结论**: TalentVault 项目当前处于**零测试覆盖**状态（仅 5 个 token 测试），对于一个涉及数据管理、文件操作、外部 API 调用的桌面应用来说，风险极高。建议立即实施 P0 计划，优先搭建测试基础设施并覆盖输入验证和关键业务逻辑。
