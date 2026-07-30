-- Consolidate stages to 4 core stages:
-- 简历筛选(keep), 简历评估→简历筛选, 初试/复试/HR面→面试, Offer沟通(keep), 待入职→已入职, 已入职(keep)

-- Step 1: Merge candidates from old stages to target stages
-- 简历评估 → 简历筛选
UPDATE candidate_pipeline
SET current_stage_id = (
    SELECT ps2.id FROM pipeline_stages ps1
    JOIN pipeline_stages ps2 ON ps1.job_id = ps2.job_id AND ps2.name = '简历筛选'
    WHERE ps1.id = candidate_pipeline.current_stage_id AND ps1.name = '简历评估'
)
WHERE current_stage_id IN (
    SELECT id FROM pipeline_stages WHERE name = '简历评估'
);

-- 初试 → 面试
UPDATE candidate_pipeline
SET current_stage_id = (
    SELECT ps2.id FROM pipeline_stages ps1
    JOIN pipeline_stages ps2 ON ps1.job_id = ps2.job_id AND ps2.name = '面试'
    WHERE ps1.id = candidate_pipeline.current_stage_id AND ps1.name = '初试'
)
WHERE current_stage_id IN (
    SELECT id FROM pipeline_stages WHERE name = '初试'
);

-- 复试 → 面试
UPDATE candidate_pipeline
SET current_stage_id = (
    SELECT ps2.id FROM pipeline_stages ps1
    JOIN pipeline_stages ps2 ON ps1.job_id = ps2.job_id AND ps2.name = '面试'
    WHERE ps1.id = candidate_pipeline.current_stage_id AND ps1.name = '复试'
)
WHERE current_stage_id IN (
    SELECT id FROM pipeline_stages WHERE name = '复试'
);

-- HR面 → 面试
UPDATE candidate_pipeline
SET current_stage_id = (
    SELECT ps2.id FROM pipeline_stages ps1
    JOIN pipeline_stages ps2 ON ps1.job_id = ps2.job_id AND ps2.name = '面试'
    WHERE ps1.id = candidate_pipeline.current_stage_id AND ps1.name = 'HR面'
)
WHERE current_stage_id IN (
    SELECT id FROM pipeline_stages WHERE name = 'HR面'
);

-- 待入职 → 已入职
UPDATE candidate_pipeline
SET current_stage_id = (
    SELECT ps2.id FROM pipeline_stages ps1
    JOIN pipeline_stages ps2 ON ps1.job_id = ps2.job_id AND ps2.name = '已入职'
    WHERE ps1.id = candidate_pipeline.current_stage_id AND ps1.name = '待入职'
)
WHERE current_stage_id IN (
    SELECT id FROM pipeline_stages WHERE name = '待入职'
);

-- Step 2: Ensure each job has the 4 target stages (create if missing)
-- pipeline_stages columns: id, job_id, name, sort_order, is_default
INSERT OR IGNORE INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
       j.id, '面试', 2, 1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = '面试');

INSERT OR IGNORE INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
       j.id, 'Offer沟通', 3, 1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = 'Offer沟通');

INSERT OR IGNORE INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
       j.id, '已入职', 4, 1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = '已入职');

-- Step 3: Update sort_order for existing stages
UPDATE pipeline_stages SET sort_order = 1 WHERE name = '简历筛选';
UPDATE pipeline_stages SET sort_order = 2 WHERE name = '面试';
UPDATE pipeline_stages SET sort_order = 3 WHERE name = 'Offer沟通';
UPDATE pipeline_stages SET sort_order = 4 WHERE name = '已入职';

-- Step 4: Delete old stages that are no longer needed
DELETE FROM pipeline_stages WHERE name IN ('简历评估', '初试', '复试', 'HR面', '录用', '待入职', '笔试');

-- Step 5: Fallback - any candidate still pointing to a deleted stage goes to 简历筛选
UPDATE candidate_pipeline
SET current_stage_id = (
    SELECT ps.id FROM pipeline_stages ps
    WHERE ps.job_id = candidate_pipeline.job_id AND ps.name = '简历筛选'
    LIMIT 1
)
WHERE current_stage_id NOT IN (
    SELECT id FROM pipeline_stages
);
