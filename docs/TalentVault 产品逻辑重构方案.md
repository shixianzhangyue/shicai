# TalentVault 产品逻辑重构方案

## 问题分析

### 当前问题
当前系统混淆了"人才"和"候选人"两个概念：
1. `candidates` 表同时存储"人才"和"候选人"
2. `inTalentPool` 是通过 `candidate_pipeline` 表的 `status='pooled'` 推导的，不是直接属性
3. `/candidates` 路由被重定向到 `/talent-pool`，两者是同一个页面
4. 简历上传后直接创建"候选人"，没有"加入人才库"的明确步骤

### 用户期望的流程
```
上传简历 → 解析 → 加入人才库（人才）
                      ↓
              人才库检索 → 找到人才
                      ↓
         人才 + 加入在招职位 = 候选人（进入招聘流程）
```

### 飞书招聘候选人模块特点
- 顶部阶段统计（简历初筛、简历评估、面试、笔试、Offer沟通、待入职、已入职、已终止）
- 左侧职位筛选（按职位分组查看候选人）
- 多维度筛选（职位类别、招聘负责人、面试官等）
- 候选人卡片（姓名、年龄、工作年限、工作经历、投递职位、面试结论）

---

## 设计方案

### 核心思路：基于现有 Pipeline 扩展

利用已有的 `candidate_pipeline` 表作为"候选人"的底层数据模型：
- **人才（Talent）** = `candidates` 表中的记录
- **候选人（Candidate）** = `candidates` + `candidate_pipeline`（有活跃 pipeline 的人才）

### 1. 简历上传流程重构

**当前流程：**
```
上传简历 → 解析 → 创建 candidate → 直接显示在候选人列表
```

**新流程：**
```
上传简历 → 解析 → 创建 candidate → 自动加入人才库（in_talent_pool=true）
                                          ↓
                              用户可从人才库"推荐"到具体职位
```

**修改文件：**
- `src-tauri/src/commands/resume_parser.rs`: 解析完成后自动设置 `in_talent_pool=true`
- `src/components/candidates/ParsePreviewDialog.tsx`: 确认后提示"已加入人才库"

### 2. 人才库模块（Talent Pool）重构

**定位：** 全量人才池，存储所有已解析的简历

**页面设计：**
- 保持现有的搜索、筛选、排序功能
- 新增"推荐到职位"按钮（从人才库选人加入在招职位）
- 移除"新建候选人"按钮（改为"新建人才"或"导入简历"）

**修改文件：**
- `src/pages/TalentPool.tsx`: 重构页面标题和操作按钮
- `src/stores/talentPoolStore.ts`: 调整 store 逻辑

### 3. 候选人模块（Candidates）独立

**定位：** 正在招聘流程中的人才，参考飞书招聘设计

**新页面设计：**

```
┌─────────────────────────────────────────────────────────────┐
│  候选人                                                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ 简历  │ │ 简历  │ │      │ │      │ │ Offer│ │ 已入 │    │
│  │ 初筛  │ │ 评估 │ │ 面试 │ │ 笔试 │ │ 沟通 │ │ 职   │    │
│  │  12   │ │  8   │ │  5   │ │  2   │ │  3   │ │  1   │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌────────────────────────────────────┐│
│  │ 职位筛选         │  │ 搜索: [姓名/电话/邮箱/公司...]     ││
│  │                 │  │                                    ││
│  │ ▼ 全部职位      │  │ [筛选] [批量操作]                   ││
│  │   产品经理      │  ├────────────────────────────────────┤│
│  │   前端开发      │  │ 候选人卡片列表                      ││
│  │   后端开发      │  │                                    ││
│  │   ...          │  │ ┌──────────────────────────────────┐││
│  │                 │  │ │ 张三 | 8年经验                   │││
│  │                 │  │ │ 商汤科技·市场经理 (2022-至今)     │││
│  │                 │  │ │ 投递职位: 产品营销               │││
│  │                 │  │ │ 面试结论: ✅ B > ✅ B            │││
│  │                 │  │ └──────────────────────────────────┘││
│  └─────────────────┘  └────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**核心功能：**
1. **阶段统计栏**：显示各阶段候选人数量
2. **职位筛选**：左侧按职位分组，点击切换
3. **搜索筛选**：多维度筛选（职位、面试官、时间等）
4. **候选人卡片**：展示工作经历、投递职位、面试结论
5. **批量操作**：批量推进、淘汰、入库
6. **阶段流转**：拖拽或点击推进到下一阶段

**修改文件：**
- `src/pages/Candidates.tsx`: 完全重写，参考飞书设计
- `src/components/candidates/CandidateCard.tsx`: 重构卡片样式
- `src/components/candidates/CandidateList.tsx`: 新增阶段统计和职位筛选
- `src/stores/candidateStore.ts`: 调整 store 支持按职位筛选

### 4. 数据库迁移

**新增字段：**
```sql
-- candidates 表新增
ALTER TABLE candidates ADD COLUMN avatar_url TEXT;
ALTER TABLE candidates ADD COLUMN age INTEGER;
ALTER TABLE candidates ADD COLUMN last_active_at TEXT;

-- candidate_pipeline 表新增
ALTER TABLE candidate_pipeline ADD COLUMN interview_conclusion TEXT;
ALTER TABLE candidate_pipeline ADD COLUMN interview_notes TEXT;
ALTER TABLE candidate_pipeline ADD COLUMN applied_at TEXT;
```

**新增索引：**
```sql
CREATE INDEX idx_candidate_pipeline_job ON candidate_pipeline(job_id);
CREATE INDEX idx_candidate_pipeline_stage ON candidate_pipeline(current_stage_id);
CREATE INDEX idx_candidate_pipeline_status ON candidate_pipeline(status);
```

### 5. 后端 API 扩展

**新增命令：**
```rust
// 获取各阶段候选人数量
#[tauri::command]
pub fn get_candidate_stage_stats(job_id: Option<String>) -> Result<Vec<StageStat>, String>;

// 按职位获取候选人列表
#[tauri::command]
pub fn list_candidates_by_job(
    job_id: String,
    stage_id: Option<String>,
    keyword: Option<String>,
    page: Option<i32>,
    page_size: Option<i32>,
) -> Result<PaginatedCandidates, String>;

// 批量推进候选人阶段
#[tauri::command]
pub fn batch_move_candidates(
    pipeline_ids: Vec<String>,
    target_stage_id: String,
) -> Result<(), String>;
```

---

## 实施计划

### Phase 1: 数据库迁移（Day 1）
- [ ] 创建 V8 migration 文件
- [ ] 新增字段和索引
- [ ] 更新 Rust 结构体

### Phase 2: 简历上传流程（Day 2）
- [ ] 修改 resume_parser.rs，解析后自动加入人才库
- [ ] 更新 ParsePreviewDialog 提示文案
- [ ] 测试完整流程

### Phase 3: 候选人模块（Day 3-4）
- [ ] 重写 Candidates.tsx 页面
- [ ] 新增阶段统计组件
- [ ] 新增职位筛选侧边栏
- [ ] 重构 CandidateCard 样式
- [ ] 实现批量操作功能

### Phase 4: 人才库优化（Day 5）
- [ ] 优化 TalentPool 页面
- [ ] 新增"推荐到职位"功能
- [ ] 调整导航菜单

### Phase 5: 测试与优化（Day 6）
- [ ] 功能测试
- [ ] UI/UX 优化
- [ ] 文档更新

---

## 关键文件清单

### 后端
- `src-tauri/src/commands/candidates.rs` - 候选人命令
- `src-tauri/src/commands/pipeline.rs` - 招聘流程命令
- `src-tauri/src/commands/resume_parser.rs` - 简历解析命令
- `src-tauri/src/db/migrations.rs` - 数据库迁移

### 前端
- `src/pages/Candidates.tsx` - 候选人页面（重写）
- `src/pages/TalentPool.tsx` - 人才库页面（优化）
- `src/components/candidates/CandidateCard.tsx` - 候选人卡片
- `src/components/candidates/CandidateList.tsx` - 候选人列表
- `src/components/layout/Sidebar.tsx` - 侧边栏导航
- `src/stores/candidateStore.ts` - 候选人状态管理
- `src/types/index.ts` - 类型定义

---

## 风险与注意事项

1. **数据迁移**：需要确保现有数据在迁移后仍能正常访问
2. **兼容性**：保持现有 API 的向后兼容
3. **性能**：阶段统计查询需要优化，避免 N+1 问题
4. **UI 一致性**：新设计需要与现有深色主题保持一致
