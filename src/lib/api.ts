import { invoke } from '@tauri-apps/api/core';
import type { Job, Tag, JobTemplate, Candidate, PaginatedCandidates, CandidateListParams, PipelineStage, PipelineEntry, CandidatePipeline, FollowUp, FollowUpWithCandidate, TalentEntry, RelationWithCandidate, CandidateRelation, OverviewStats, FunnelData, TrendData, ExportableFieldMeta, ExportResult, ExportConfig, LlmConfig, ParsedResume, OcrConfig, CreateOcrConfigInput, UpdateOcrConfigInput, OcrResult, StageStat, PaginatedCandidateWithPipeline, JobWithCandidateCount, ResumeRecord, AuditLogEntry, CloudConfig, SaveCloudConfigInput, SyncLogEntry, RecentActivity, BatchParseItem, PortfolioItem } from '@/types';

// Wrapper for Tauri invoke (Tauri v2 auto-converts camelCase args to snake_case)
async function snakeInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  return invoke<T>(cmd, args);
}

function handleError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg;
}

/** Maps a frontend Candidate-like object to snake_case for Rust CreateCandidateInput. */
function mapCreateCandidateInput(
  input: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  autoPool?: boolean
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
    auto_pool: autoPool ?? false,
    // V8 enhanced fields
    gender: input.gender,
    birth_date: input.birthDate,
    expected_city: input.expectedCity,
    expected_salary: input.expectedSalary,
    graduation_date: input.graduationDate,
    school: input.school,
    major: input.major,
    source_detail: input.sourceDetail,
    work_experiences: input.workExperiences,
    education_history: input.educationHistory,
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
  // V8 enhanced fields
  if (input.gender !== undefined) mapped.gender = input.gender;
  if (input.birthDate !== undefined) mapped.birth_date = input.birthDate;
  if (input.expectedCity !== undefined) mapped.expected_city = input.expectedCity;
  if (input.expectedSalary !== undefined) mapped.expected_salary = input.expectedSalary;
  if (input.graduationDate !== undefined) mapped.graduation_date = input.graduationDate;
  if (input.school !== undefined) mapped.school = input.school;
  if (input.major !== undefined) mapped.major = input.major;
  if (input.sourceDetail !== undefined) mapped.source_detail = input.sourceDetail;
  if (input.workExperiences !== undefined) mapped.work_experiences = input.workExperiences;
  if (input.educationHistory !== undefined) mapped.education_history = input.educationHistory;
  if (input.isStarred !== undefined) mapped.is_starred = input.isStarred;
  if (input.isHidden !== undefined) mapped.is_hidden = input.isHidden;
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
    list: () => snakeInvoke<Tag[]>('list_tags'),
    create: (name: string, color?: string) =>
      snakeInvoke<Tag>('create_tag', { name, color }),
    update: (id: string, data: { name?: string; color?: string }) =>
      snakeInvoke<Tag>('update_tag', { id, ...data }),
    delete: (id: string) => snakeInvoke<void>('delete_tag', { id }),
  },
  candidates: {
    list: (params?: CandidateListParams) => snakeInvoke<PaginatedCandidates>('list_candidates', {
      keyword: params?.keyword,
      tags: params?.tags,
      education: params?.education,
      minExp: params?.minExp,
      maxExp: params?.maxExp,
      source: params?.source,
      inTalentPool: params?.inTalentPool,
      excludeActivePipeline: params?.excludeActivePipeline,
      page: params?.page,
      pageSize: params?.pageSize,
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder,
    }),
    get: (id: string) => snakeInvoke<Candidate>('get_candidate', { id }),
    create: (input: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'inTalentPool'>, autoPool?: boolean) =>
      snakeInvoke<Candidate>('create_candidate', { input: mapCreateCandidateInput(input, autoPool) }),
    update: (id: string, input: Partial<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'inTalentPool'>>) =>
      snakeInvoke<Candidate>('update_candidate', { id, input: mapUpdateCandidateInput(input) }),
    delete: (id: string) => snakeInvoke<void>('delete_candidate', { id }),
    listDeleted: () => snakeInvoke<Candidate[]>('list_deleted_candidates'),
    restore: (id: string) => snakeInvoke<void>('restore_candidate', { id }),
    permanentlyDelete: (id: string) => snakeInvoke<void>('permanently_delete_candidate', { id }),
  },
  jobs: {
    list: () => snakeInvoke<Job[]>('list_jobs'),
    get: (id: string) => snakeInvoke<Job>('get_job', { id }),
    create: (input: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) =>
      snakeInvoke<Job>('create_job', { input: mapCreateJobInput(input) }),
    update: (id: string, input: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>>) =>
      snakeInvoke<Job>('update_job', { id, input: mapUpdateJobInput(input) }),
    delete: (id: string) => snakeInvoke<void>('delete_job', { id }),
    duplicate: (id: string) => snakeInvoke<Job>('duplicate_job', { id }),
  },
  jobTemplates: {
    list: () => snakeInvoke<JobTemplate[]>('list_job_templates'),
    create: (name: string, content: string) =>
      snakeInvoke<JobTemplate>('create_job_template', { name, content }),
    delete: (id: string) => snakeInvoke<void>('delete_job_template', { id }),
  },
  pipeline: {
    getStagesByJob: (jobId: string) => snakeInvoke<PipelineStage[]>('get_stages_by_job', { jobId }),
    createStage: (jobId: string, name: string, sortOrder: number) =>
      snakeInvoke<PipelineStage>('create_stage', { jobId, name, sortOrder }),
    updateStage: (id: string, data: { name?: string; sortOrder?: number }) =>
      snakeInvoke<PipelineStage>('update_stage', { id, ...data }),
    deleteStage: (id: string) => snakeInvoke<void>('delete_stage', { id }),
    reorderStages: (jobId: string, stageIds: string[]) =>
      snakeInvoke<void>('reorder_stages', { jobId, stageIds }),
    initDefaultStages: (jobId: string) => snakeInvoke<PipelineStage[]>('init_default_stages', { jobId }),
    getPipelineByJob: (jobId: string) => snakeInvoke<PipelineEntry[]>('get_pipeline_by_job', { jobId }),
    getPipelineByCandidate: (candidateId: string) => snakeInvoke<PipelineEntry[]>('get_pipeline_by_candidate', { candidateId }),
    addToJob: (candidateId: string, jobId: string) =>
      snakeInvoke<CandidatePipeline>('add_to_job', { candidateId, jobId }),
    moveToStage: (pipelineId: string, stageId: string) =>
      snakeInvoke<CandidatePipeline>('move_to_stage', { pipelineId, stageId }),
    rejectCandidate: (pipelineId: string) =>
      snakeInvoke<CandidatePipeline>('reject_candidate', { pipelineId }),
    poolCandidate: (pipelineId: string) =>
      snakeInvoke<CandidatePipeline>('pool_candidate', { pipelineId }),
    batchMove: (pipelineIds: string[], stageId: string) =>
      snakeInvoke<void>('batch_move', { pipelineIds, stageId }),
    batchReject: (pipelineIds: string[]) =>
      snakeInvoke<void>('batch_reject', { pipelineIds }),
    getStageStats: (jobId?: string) =>
      snakeInvoke<StageStat[]>('get_stage_stats', { jobId: jobId || null }),
    listCandidatesByJob: (params: {
      jobId?: string;
      stageId?: string;
      stageName?: string;
      keyword?: string;
      page?: number;
      pageSize?: number;
    }) => snakeInvoke<PaginatedCandidateWithPipeline>('list_candidates_by_job', {
      jobId: params.jobId || null,
      stageId: params.stageId || null,
      stageName: params.stageName || null,
      keyword: params.keyword || null,
      page: params.page || null,
      pageSize: params.pageSize || null,
    }),
    getJobsWithCandidates: () =>
      snakeInvoke<JobWithCandidateCount[]>('get_jobs_with_candidates'),
    removeFromJob: (pipelineId: string) =>
      snakeInvoke<void>('remove_from_job', { pipelineId }),
    getAuditLog: (candidateId: string) =>
      snakeInvoke<AuditLogEntry[]>('get_audit_log', { candidateId }),
  },
  talentPool: {
    list: (filters?: {
      keyword?: string;
      tags?: string[];
      source?: string;
      originalJobId?: string;
    }) => snakeInvoke<TalentEntry[]>('list_talent_pool', filters || {}),
    reactivate: (candidateId: string, jobId: string) =>
      snakeInvoke<CandidatePipeline>('reactivate_candidate', { candidateId, jobId }),
    checkDuplicate: (phone?: string, email?: string) =>
      snakeInvoke<Candidate[]>('check_duplicate', { phone, email }),
    getSearchIndex: () => snakeInvoke<{ id: string; name: string; phoneLast4: string | null }[]>('get_candidate_search_index'),
  },
  followUps: {
    list: (candidateId: string) => snakeInvoke<FollowUp[]>('list_follow_ups', { candidateId }),
    create: (data: {
      candidateId: string;
      content: string;
      followType: string;
      result?: string;
      nextFollowDate?: string;
      relatedJobId?: string;
    }) => snakeInvoke<FollowUp>('create_follow_up', data),
    delete: (id: string) => snakeInvoke<void>('delete_follow_up', { id }),
    getToday: () => snakeInvoke<FollowUpWithCandidate[]>('get_today_follow_ups'),
  },
  relations: {
    list: (candidateId: string) =>
      snakeInvoke<RelationWithCandidate[]>('list_relations', { candidateId }),
    create: (data: {
      candidateIdA: string;
      candidateIdB: string;
      relationType: string;
      note?: string;
    }) => snakeInvoke<CandidateRelation>('create_relation', data),
    delete: (id: string) => snakeInvoke<void>('delete_relation', { id }),
  },
  stats: {
    overview: () => snakeInvoke<OverviewStats>('get_overview_stats'),
    funnel: (jobId?: string) => snakeInvoke<FunnelData[]>('get_funnel_data', { jobId: jobId ?? null }),
    recentActivity: (limit?: number) => snakeInvoke<RecentActivity[]>('get_recent_activity', { limit: limit ?? 10 }),
    trendData: () => snakeInvoke<TrendData>('get_trend_data'),
  },
  export: {
    fields: () => snakeInvoke<ExportableFieldMeta[]>('get_exportable_fields'),
    export: (config: ExportConfig) => snakeInvoke<ExportResult>('export_data', { config }),
  },
  backup: {
    export: (path: string) => snakeInvoke<string>('export_backup', { outputPath: path }),
    import: (path: string) => snakeInvoke<string>('import_backup', { zipPath: path }),
    rollback: () => snakeInvoke<string>('rollback_backup'),
  },
  cloudSync: {
    getAllStatus: () => snakeInvoke<CloudConfig[]>('get_all_sync_status'),
    getConfig: (provider: string) => snakeInvoke<CloudConfig>('get_cloud_config', { provider }),
    saveConfig: (input: SaveCloudConfigInput) => snakeInvoke<CloudConfig>('save_cloud_config', { input }),
    deleteConfig: (provider: string) => snakeInvoke<string>('delete_cloud_config', { provider }),
    testConnection: (provider: string) => snakeInvoke<string>('test_cloud_connection', { provider }),
    initOAuth: () => snakeInvoke<string>('init_onedrive_oauth'),
    completeOAuth: (code: string) => snakeInvoke<{ success: boolean; message: string }>('complete_onedrive_oauth', { code }),
    syncToCloud: (provider: string, localFilePath: string, cloudFileName?: string) => snakeInvoke<string>('sync_to_cloud', { provider, localFilePath, cloudFileName }),
    syncFromCloud: (provider: string, cloudFilePath: string, localFilePath: string) => snakeInvoke<string>('sync_from_cloud', { provider, cloudFilePath, localFilePath }),
    getLog: (provider?: string, page?: number, pageSize?: number) => snakeInvoke<SyncLogEntry[]>('get_sync_log', { provider, page: page ?? 1, pageSize: pageSize ?? 20 }),
  },
  llmConfigs: {
    list: () => snakeInvoke<LlmConfig[]>('list_llm_configs'),
    create: (input: Omit<LlmConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
      snakeInvoke<LlmConfig>('create_llm_config', { input }),
    update: (id: number, input: Partial<Omit<LlmConfig, 'id' | 'createdAt' | 'updatedAt'>>) =>
      snakeInvoke<LlmConfig>('update_llm_config', { id, input }),
    delete: (id: number) => snakeInvoke<void>('delete_llm_config', { id }),
    getDefault: () => snakeInvoke<LlmConfig | null>('get_default_llm_config'),
    test: (config: { provider: string; apiKey: string; baseUrl: string; modelName: string }) =>
      snakeInvoke<string>('test_llm_connection', config),
  },
  resumeParser: {
    parse: (filePath: string) => snakeInvoke<ParsedResume>('parse_resume', { filePath }),
    parseText: (text: string) => snakeInvoke<ParsedResume>('parse_resume_text', { text }),
    parseEnhance: (
      rawTextFull: string,
      currentData: ParsedResume,
      fieldsToEnhance: string[],
    ) =>
      snakeInvoke<ParsedResume>('parse_resume_enhance', {
        rawTextFull,
        currentData,
        fieldsToEnhance,
      }),
    batchParse: (filePaths: string[]) =>
      snakeInvoke<BatchParseItem[]>('batch_parse_resumes', { filePaths }),
    parseImageBase64: (imageBase64: string) =>
      snakeInvoke<ParsedResume>('parse_resume_image_base64', { imageBase64 }),
    save: (
      candidateId: string,
      filePath: string,
      parsedData?: ParsedResume,
    ) =>
      snakeInvoke<ResumeRecord>('save_resume', {
        candidateId,
        filePath,
        parsedData: parsedData ?? null,
      }),
    list: (candidateId: string) =>
      snakeInvoke<ResumeRecord[]>('list_resumes', { candidateId }),
  },
  ocrConfigs: {
    list: () => snakeInvoke<OcrConfig[]>('list_ocr_configs'),
    create: (input: CreateOcrConfigInput) =>
      snakeInvoke<OcrConfig>('create_ocr_config', { input }),
    update: (id: number, input: UpdateOcrConfigInput) =>
      snakeInvoke<OcrConfig>('update_ocr_config', { id, input }),
    delete: (id: number) => snakeInvoke<void>('delete_ocr_config', { id }),
    getDefault: () => snakeInvoke<OcrConfig | null>('get_default_ocr_config'),
    test: (config: { provider: string; apiKey: string; secretKey: string }) =>
      snakeInvoke<string>('test_ocr_connection', config),
    recognize: (imageBase64: string) => snakeInvoke<OcrResult>('ocr_image', { imageBase64 }),
  },
  portfolio: {
    uploadFile: (candidateId: string, filePath: string, description?: string) =>
      snakeInvoke<PortfolioItem>('upload_portfolio_file', { candidateId, filePath, description: description ?? null }),
    addLink: (candidateId: string, url: string, fileName: string, description?: string) =>
      snakeInvoke<PortfolioItem>('add_portfolio_link', { candidateId, url, fileName, description: description ?? null }),
    list: (candidateId: string) =>
      snakeInvoke<PortfolioItem[]>('list_portfolios', { candidateId }),
    delete: (id: string) =>
      snakeInvoke<void>('delete_portfolio', { id }),
  },
};

export { handleError };
