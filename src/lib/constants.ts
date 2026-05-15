export const APP_NAME = 'TalentVault';

export const DEFAULT_PIPELINE_STAGES = [
  '简历筛选',
  '初面',
  '复面',
  '终面',
  '待入职',
];

export const JOB_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  open: '招聘中',
  paused: '暂停',
  closed: '已关闭',
};

export const EDUCATION_OPTIONS: string[] = ['高中', '大专', '本科', '硕士', '博士'];

export const CANDIDATE_SOURCE_OPTIONS: Record<string, string> = {
  manual: '手动录入',
  import: '批量导入',
  referral: '推荐',
};

export const FOLLOW_TYPE_OPTIONS: Record<string, string> = {
  phone: '电话',
  wechat: '微信',
  meeting: '面谈',
  email: '邮件',
  other: '其他',
};

export const FOLLOW_RESULT_OPTIONS: Record<string, string> = {
  positive: '意向积极',
  neutral: '意向一般',
  declined: '暂不考虑',
  accepted: '已接受',
  rejected: '已拒绝',
};

export const RELATION_TYPE_OPTIONS: Record<string, string> = {
  colleague: '同事',
  superior: '上级',
  referral: '推荐人',
  friend: '朋友',
  classmate: '同学',
  other: '其他',
};
