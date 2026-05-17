export type ProviderType = 'openai' | 'baidu_ernie' | 'qwen' | 'xunfei' | 'custom';

export type ParseStage = 'idle' | 'selecting' | 'extracting' | 'parsing' | 'preview' | 'filled' | 'error' | 'ai_enhancing';

export interface LlmConfig {
  id: number;
  provider: ProviderType;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkExperience {
  company: string;
  position: string;
  duration: string;
  description?: string;
}

export interface ProjectExperience {
  name: string;
  role?: string;
  duration?: string;
  description?: string;
  technologies: string[];
}

export interface ParsedResume {
  name: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  birthDate: string | null;
  currentCompany: string | null;
  currentPosition: string | null;
  education: string | null;
  yearsExp: number | null;
  expectedSalary: string | null;
  expectedCity: string | null;
  selfIntroduction: string | null;
  skills: string[];
  workExperiences: WorkExperience[];
  projectExperiences: ProjectExperience[];
  rawTextPreview: string;
  rawTextFull: string;
  parseSource: string;
}

export type JobStatus = 'draft' | 'open' | 'paused' | 'closed';
export type PipelineStatus = 'active' | 'rejected' | 'pooled';
export type EducationLevel = '高中' | '大专' | '本科' | '硕士' | '博士';
export type CandidateSource = 'manual' | 'import' | 'referral';
export type ResumeFileType = 'pdf' | 'docx' | 'jpg' | 'png';
export type FollowType = 'phone' | 'wechat' | 'meeting' | 'email' | 'other';
export type FollowResult = 'positive' | 'neutral' | 'declined' | 'accepted' | 'rejected';
export type RelationType = 'colleague' | 'superior' | 'referral' | 'friend' | 'classmate' | 'other';

export type ExportableField =
  | 'name' | 'phone' | 'email' | 'currentCompany' | 'currentPosition'
  | 'education' | 'yearsExp' | 'source' | 'tags' | 'createdAt';

export interface ExportConfig {
  fields: ExportableField[];
  fieldOrder: ExportableField[];
  format: 'xlsx' | 'csv';
  scope: 'all' | 'filtered' | 'job';
  jobId?: string;
  candidateIds?: string[];
}

export interface ExportableFieldMeta {
  key: ExportableField;
  label: string;
}

export interface ExportResult {
  data: Partial<Record<ExportableField, string>>[];
  fieldOrder: ExportableField[];
}

export interface Job {
  id: string;
  title: string;
  department: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string | null;
  requirements: string | null;
  status: JobStatus;
  tags: string[];
  headcount: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  currentCompany: string | null;
  currentPosition: string | null;
  education: EducationLevel | null;
  yearsExp: number | null;
  source: CandidateSource;
  tags: string[];
  inTalentPool: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // V12 enhanced fields
  avatarUrl: string | null;
  age: number | null;
  lastActiveAt: string | null;
}

export interface PaginatedCandidates {
  items: Candidate[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CandidateListParams {
  keyword?: string;
  tags?: string[];
  education?: string;
  minExp?: number;
  maxExp?: number;
  source?: string;
  inTalentPool?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CandidateSearchIndex {
  id: string;
  name: string;
  phoneLast4: string | null;
}

export interface Resume {
  id: string;
  candidateId: string;
  filePath: string;
  fileName: string;
  fileType: ResumeFileType;
  parsedData: Record<string, unknown> | null;
  uploadedAt: string;
}

export interface PipelineStage {
  id: string;
  jobId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
}

export interface CandidatePipeline {
  id: string;
  candidateId: string;
  jobId: string;
  currentStageId: string | null;
  status: PipelineStatus;
  enteredAt: string;
  updatedAt: string;
  interviewConclusion: string | null;
  interviewNotes: string | null;
  appliedAt: string | null;
}

export interface StageStat {
  stageName: string;
  count: number;
}

export interface CandidateWithPipeline {
  pipelineId: string;
  candidateId: string;
  name: string;
  phone: string | null;
  email: string | null;
  currentCompany: string | null;
  currentPosition: string | null;
  yearsExp: number | null;
  age: number | null;
  avatarUrl: string | null;
  jobId: string;
  jobTitle: string;
  currentStageId: string | null;
  currentStageName: string | null;
  status: string;
  interviewConclusion: string | null;
  interviewNotes: string | null;
  appliedAt: string | null;
  updatedAt: string;
}

export interface PaginatedCandidateWithPipeline {
  items: CandidateWithPipeline[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobWithCandidateCount {
  id: string;
  title: string;
  candidateCount: number;
}

export interface FollowUp {
  id: string;
  candidateId: string;
  content: string;
  followType: FollowType;
  result: FollowResult | null;
  nextFollowDate: string | null;
  relatedJobId: string | null;
  createdAt: string;
}

export interface CandidateRelation {
  id: string;
  candidateIdA: string;
  candidateIdB: string;
  relationType: RelationType;
  note: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface JobTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface ImportRow {
  name: string;
  phone?: string;
  email?: string;
  currentCompany?: string;
  currentPosition?: string;
  education?: string;
  yearsExp?: number;
  source?: string;
}

export interface ImportResult {
  success: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface OverviewStats {
  openJobs: number;
  totalCandidates: number;
  talentPoolSize: number;
  todayFollowUps: number;
  totalHeadcount: number;
  hiredCount: number;
}

export interface FunnelData {
  jobId: string;
  jobTitle: string;
  stageName: string;
  count: number;
}

export interface RelationWithCandidate {
  relation: CandidateRelation;
  candidate: Candidate;
}

export interface AuditLog {
  id: string;
  tableName: 'jobs' | 'candidates';
  recordId: string;
  action: 'soft_delete' | 'restore' | 'hard_delete';
  oldData: Record<string, unknown> | null;
  performedAt: string;
}

export interface PipelineEntry {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  currentStageId: string | null;
  currentStageName: string | null;
  status: string;
  enteredAt: string;
  updatedAt: string;
  interviewConclusion: string | null;
  interviewNotes: string | null;
  appliedAt: string | null;
}

export interface FollowUpWithCandidate {
  followUp: FollowUp;
  candidate: Candidate;
}

export interface TalentEntry {
  candidateId: string;
  candidateName: string;
  candidatePhone: string | null;
  candidateEmail: string | null;
  originalJobId: string | null;
  originalJobTitle: string | null;
  pooledAt: string;
}

export interface OcrConfig {
  id: number;
  provider: string;
  apiKey: string;
  secretKey: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOcrConfigInput {
  provider: string;
  apiKey: string;
  secretKey: string;
}

export interface UpdateOcrConfigInput {
  provider?: string;
  apiKey?: string;
  secretKey?: string;
  isDefault?: boolean;
}

export interface WordsResult {
  words: string;
}

export interface OcrResult {
  text: string;
  wordsResult: WordsResult[];
  wordsResultNum: number;
  rawResponse: Record<string, unknown>;
}
