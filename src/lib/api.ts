import { invoke } from '@tauri-apps/api/core';
import type { Job, Tag, JobTemplate, Candidate, PaginatedCandidates, CandidateListParams, PipelineStage, PipelineEntry, CandidatePipeline, FollowUp, FollowUpWithCandidate, TalentEntry, RelationWithCandidate, CandidateRelation, OverviewStats, FunnelData, ExportableFieldMeta, ExportResult, ExportConfig, LlmConfig, ParsedResume, OcrConfig, CreateOcrConfigInput, UpdateOcrConfigInput, OcrResult } from '@/types';

function handleError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg;
}

/** Maps a frontend Candidate-like object to snake_case for Rust CreateCandidateInput. */
function mapCreateCandidateInput(
  input: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
): Record<string, unknown> {
  return {
    name: input.name,
    phone: input.phone,
    email: input.email,
    current_company: input.currentCompany,
    current_position: input.currentPosition,
    education: input.education,
    years_exp: input.yearsExp,
    source: input.source,
    tags: input.tags,
  };
}

/** Maps a frontend partial Candidate-like object to snake_case for Rust UpdateCandidateInput. */
function mapUpdateCandidateInput(
  input: Partial<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  if (input.name !== undefined) mapped.name = input.name;
  if (input.phone !== undefined) mapped.phone = input.phone;
  if (input.email !== undefined) mapped.email = input.email;
  if (input.currentCompany !== undefined) mapped.current_company = input.currentCompany;
  if (input.currentPosition !== undefined) mapped.current_position = input.currentPosition;
  if (input.education !== undefined) mapped.education = input.education;
  if (input.yearsExp !== undefined) mapped.years_exp = input.yearsExp;
  if (input.source !== undefined) mapped.source = input.source;
  if (input.tags !== undefined) mapped.tags = input.tags;
  return mapped;
}

/** Maps a frontend Job-like object to snake_case for Rust CreateJobInput. */
function mapCreateJobInput(
  input: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>
): Record<string, unknown> {
  return {
    title: input.title,
    department: input.department,
    salary_min: input.salaryMin,
    salary_max: input.salaryMax,
    description: input.description,
    requirements: input.requirements,
    status: input.status,
    tags: input.tags,
    headcount: input.headcount,
  };
}

/** Maps a frontend partial Job-like object to snake_case for Rust UpdateJobInput. */
function mapUpdateJobInput(
  input: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>>
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  if (input.title !== undefined) mapped.title = input.title;
  if (input.department !== undefined) mapped.department = input.department;
  if (input.salaryMin !== undefined) mapped.salary_min = input.salaryMin;
  if (input.salaryMax !== undefined) mapped.salary_max = input.salaryMax;
  if (input.description !== undefined) mapped.description = input.description;
  if (input.requirements !== undefined) mapped.requirements = input.requirements;
  if (input.status !== undefined) mapped.status = input.status;
  if (input.tags !== undefined) mapped.tags = input.tags;
  if (input.headcount !== undefined) mapped.headcount = input.headcount;
  return mapped;
}

export const api = {
  tags: {
    list: () => invoke<Tag[]>('list_tags'),
    create: (name: string, color?: string) =>
      invoke<Tag>('create_tag', { name, color }),
    update: (id: string, data: { name?: string; color?: string }) =>
      invoke<Tag>('update_tag', { id, ...data }),
    delete: (id: string) => invoke<void>('delete_tag', { id }),
  },
  candidates: {
    list: (params?: CandidateListParams) => invoke<PaginatedCandidates>('list_candidates', {
      keyword: params?.keyword,
      tags: params?.tags,
      education: params?.education,
      min_exp: params?.minExp,
      max_exp: params?.maxExp,
      source: params?.source,
      in_talent_pool: params?.inTalentPool,
      page: params?.page,
      page_size: params?.pageSize,
      sort_by: params?.sortBy,
      sort_order: params?.sortOrder,
    }),
    get: (id: string) => invoke<Candidate>('get_candidate', { id }),
    create: (input: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'inTalentPool'>) =>
      invoke<Candidate>('create_candidate', { input: mapCreateCandidateInput(input) }),
    update: (id: string, input: Partial<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'inTalentPool'>>) =>
      invoke<Candidate>('update_candidate', { id, input: mapUpdateCandidateInput(input) }),
    delete: (id: string) => invoke<void>('delete_candidate', { id }),
  },
  jobs: {
    list: () => invoke<Job[]>('list_jobs'),
    get: (id: string) => invoke<Job>('get_job', { id }),
    create: (input: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) =>
      invoke<Job>('create_job', { input: mapCreateJobInput(input) }),
    update: (id: string, input: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>>) =>
      invoke<Job>('update_job', { id, input: mapUpdateJobInput(input) }),
    delete: (id: string) => invoke<void>('delete_job', { id }),
    duplicate: (id: string) => invoke<Job>('duplicate_job', { id }),
  },
  jobTemplates: {
    list: () => invoke<JobTemplate[]>('list_job_templates'),
    create: (name: string, content: string) =>
      invoke<JobTemplate>('create_job_template', { name, content }),
    delete: (id: string) => invoke<void>('delete_job_template', { id }),
  },
  pipeline: {
    getStagesByJob: (jobId: string) => invoke<PipelineStage[]>('get_stages_by_job', { jobId }),
    createStage: (jobId: string, name: string, sortOrder: number) =>
      invoke<PipelineStage>('create_stage', { jobId, name, sortOrder }),
    updateStage: (id: string, data: { name?: string; sortOrder?: number }) =>
      invoke<PipelineStage>('update_stage', { id, ...data }),
    deleteStage: (id: string) => invoke<void>('delete_stage', { id }),
    reorderStages: (jobId: string, stageIds: string[]) =>
      invoke<void>('reorder_stages', { jobId, stageIds }),
    initDefaultStages: (jobId: string) => invoke<PipelineStage[]>('init_default_stages', { jobId }),
    getPipelineByJob: (jobId: string) => invoke<PipelineEntry[]>('get_pipeline_by_job', { jobId }),
    addToJob: (candidateId: string, jobId: string) =>
      invoke<CandidatePipeline>('add_to_job', { candidateId, jobId }),
    moveToStage: (pipelineId: string, stageId: string) =>
      invoke<CandidatePipeline>('move_to_stage', { pipelineId, stageId }),
    rejectCandidate: (pipelineId: string) =>
      invoke<CandidatePipeline>('reject_candidate', { pipelineId }),
    poolCandidate: (pipelineId: string) =>
      invoke<CandidatePipeline>('pool_candidate', { pipelineId }),
    batchMove: (pipelineIds: string[], stageId: string) =>
      invoke<void>('batch_move', { pipelineIds, stageId }),
    batchReject: (pipelineIds: string[]) =>
      invoke<void>('batch_reject', { pipelineIds }),
  },
  talentPool: {
    list: (filters?: {
      keyword?: string;
      tags?: string[];
      source?: string;
      originalJobId?: string;
    }) => invoke<TalentEntry[]>('list_talent_pool', filters || {}),
    reactivate: (candidateId: string, jobId: string) =>
      invoke<CandidatePipeline>('reactivate_candidate', { candidateId, jobId }),
    checkDuplicate: (phone?: string, email?: string) =>
      invoke<Candidate[]>('check_duplicate', { phone, email }),
    getSearchIndex: () => invoke<{ id: string; name: string; phoneLast4: string | null }[]>('get_candidate_search_index'),
  },
  followUps: {
    list: (candidateId: string) => invoke<FollowUp[]>('list_follow_ups', { candidateId }),
    create: (data: {
      candidateId: string;
      content: string;
      followType: string;
      result?: string;
      nextFollowDate?: string;
      relatedJobId?: string;
    }) => invoke<FollowUp>('create_follow_up', data),
    delete: (id: string) => invoke<void>('delete_follow_up', { id }),
    getToday: () => invoke<FollowUpWithCandidate[]>('get_today_follow_ups'),
  },
  relations: {
    list: (candidateId: string) =>
      invoke<RelationWithCandidate[]>('list_relations', { candidateId }),
    create: (data: {
      candidateIdA: string;
      candidateIdB: string;
      relationType: string;
      note?: string;
    }) => invoke<CandidateRelation>('create_relation', {
      candidate_id_a: data.candidateIdA,
      candidate_id_b: data.candidateIdB,
      relation_type: data.relationType,
      note: data.note,
    }),
    delete: (id: string) => invoke<void>('delete_relation', { id }),
  },
  stats: {
    overview: () => invoke<OverviewStats>('get_overview_stats'),
    funnel: (jobId?: string) => invoke<FunnelData[]>('get_funnel_data', { jobId: jobId ?? null }),
  },
  export: {
    fields: () => invoke<ExportableFieldMeta[]>('get_exportable_fields'),
    export: (config: ExportConfig) => invoke<ExportResult>('export_data', { config }),
  },
  backup: {
    export: (path: string) => invoke<string>('export_backup', { outputPath: path }),
    import: (path: string) => invoke<string>('import_backup', { zipPath: path }),
    rollback: () => invoke<string>('rollback_backup'),
  },
  llmConfigs: {
    list: () => invoke<LlmConfig[]>('list_llm_configs'),
    create: (input: Omit<LlmConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
      invoke<LlmConfig>('create_llm_config', { input }),
    update: (id: number, input: Partial<Omit<LlmConfig, 'id' | 'createdAt' | 'updatedAt'>>) =>
      invoke<LlmConfig>('update_llm_config', { id, input }),
    delete: (id: number) => invoke<void>('delete_llm_config', { id }),
    getDefault: () => invoke<LlmConfig | null>('get_default_llm_config'),
    test: (config: { provider: string; apiKey: string; baseUrl: string; modelName: string }) =>
      invoke<string>('test_llm_connection', {
        provider: config.provider,
        api_key: config.apiKey,
        base_url: config.baseUrl,
        model_name: config.modelName,
      }),
  },
  resumeParser: {
    parse: (filePath: string) => invoke<ParsedResume>('parse_resume', { file_path: filePath }),
    parseText: (text: string) => invoke<ParsedResume>('parse_resume_text', { text }),
    parseEnhance: (
      rawTextFull: string,
      currentData: ParsedResume,
      fieldsToEnhance: string[],
    ) =>
      invoke<ParsedResume>('parse_resume_enhance', {
        raw_text_full: rawTextFull,
        current_data: currentData,
        fields_to_enhance: fieldsToEnhance,
      }),
  },
  ocrConfigs: {
    list: () => invoke<OcrConfig[]>('list_ocr_configs'),
    create: (input: CreateOcrConfigInput) =>
      invoke<OcrConfig>('create_ocr_config', { input }),
    update: (id: number, input: UpdateOcrConfigInput) =>
      invoke<OcrConfig>('update_ocr_config', { id, input }),
    delete: (id: number) => invoke<void>('delete_ocr_config', { id }),
    getDefault: () => invoke<OcrConfig | null>('get_default_ocr_config'),
    test: (config: { provider: string; apiKey: string; secretKey: string }) =>
      invoke<string>('test_ocr_connection', {
        api_key: config.apiKey,
        secret_key: config.secretKey,
      }),
    recognize: (imageBase64: string) => invoke<OcrResult>('ocr_image', { image_base64: imageBase64 }),
  },
};

export { handleError };
