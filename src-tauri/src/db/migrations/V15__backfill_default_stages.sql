-- V15: Backfill missing default stages for existing jobs.
-- Adds missing stages after the existing maximum sort_order for each job.

-- For each job, add missing stages with sort_order = max_existing + N

-- 简历评估
INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT hex(randomblob(16)), j.id, '简历评估',
  COALESCE((SELECT MAX(ps.sort_order) FROM pipeline_stages ps WHERE ps.job_id = j.id), 0) + 1,
  1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = '简历评估');

-- 初试
INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT hex(randomblob(16)), j.id, '初试',
  COALESCE((SELECT MAX(ps.sort_order) FROM pipeline_stages ps WHERE ps.job_id = j.id), 0) + 1,
  1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = '初试');

-- 复试
INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT hex(randomblob(16)), j.id, '复试',
  COALESCE((SELECT MAX(ps.sort_order) FROM pipeline_stages ps WHERE ps.job_id = j.id), 0) + 1,
  1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = '复试');

-- HR面
INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT hex(randomblob(16)), j.id, 'HR面',
  COALESCE((SELECT MAX(ps.sort_order) FROM pipeline_stages ps WHERE ps.job_id = j.id), 0) + 1,
  1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = 'HR面');

-- Offer沟通
INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT hex(randomblob(16)), j.id, 'Offer沟通',
  COALESCE((SELECT MAX(ps.sort_order) FROM pipeline_stages ps WHERE ps.job_id = j.id), 0) + 1,
  1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = 'Offer沟通');

-- 待入职
INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT hex(randomblob(16)), j.id, '待入职',
  COALESCE((SELECT MAX(ps.sort_order) FROM pipeline_stages ps WHERE ps.job_id = j.id), 0) + 1,
  1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = '待入职');

-- 已入职
INSERT INTO pipeline_stages (id, job_id, name, sort_order, is_default)
SELECT hex(randomblob(16)), j.id, '已入职',
  COALESCE((SELECT MAX(ps.sort_order) FROM pipeline_stages ps WHERE ps.job_id = j.id), 0) + 1,
  1
FROM jobs j
WHERE j.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.job_id = j.id AND ps.name = '已入职');
