import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { notify } from '@/lib/notify';
import type { Candidate, FollowUp, PipelineEntry, ResumeRecord, ResumeFileType, PortfolioItem } from '@/types';
import { useTagStore } from '@/stores/tagStore';
import {
  X, Phone, Mail, GraduationCap, MapPin, Tag, FileText, Briefcase,
  MessageSquare, StickyNote, ChevronRight, ChevronDown, Star,
  UserPlus, LogIn, LogOut, XCircle, Archive, Image as ImageIcon,
  Plus, ExternalLink, Link, Trash2, Upload, Loader2
} from 'lucide-react';
import { confirm } from '@/components/ui/ConfirmDialog';
import { ResumePreview } from './ResumePreview';
import { RecommendToJobDialog } from './RecommendToJobDialog';
import { FollowUpDialog } from './FollowUpDialog';

interface CandidateDetailProps {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
}

const FOLLOW_TYPE_LABELS: Record<string, string> = {
  phone: '电话', wechat: '微信', meeting: '面谈', email: '邮件', other: '其他',
};
const FOLLOW_TYPE_COLORS: Record<string, string> = {
  phone: '#8b5cf6', wechat: '#10b981', meeting: '#f59e0b', email: '#3b82f6', other: '#64748b',
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '进行中', color: 'bg-green-400/10 text-green-400' },
  rejected: { label: '已淘汰', color: 'bg-red-400/10 text-red-400' },
  pooled: { label: '人才库', color: 'bg-blue-400/10 text-blue-400' },
};

type LeftTab = 'attachment' | 'standard' | 'extra';

export function CandidateDetail({ candidate, open, onClose }: CandidateDetailProps) {
  const tags = useTagStore((s) => s.tags);
  const [leftTab, setLeftTab] = useState<LeftTab>('attachment');
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineEntry[]>([]);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [stagesMap, setStagesMap] = useState<Record<string, { id: string; name: string }[]>>({});
  const [activeJobIndex, setActiveJobIndex] = useState(0);
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const jobSelectorRef = useRef<HTMLDivElement>(null);

  const candidateTags = tags.filter((t) => candidate?.tags.includes(t.id));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (jobSelectorRef.current && !jobSelectorRef.current.contains(e.target as Node)) {
        setShowJobSelector(false);
      }
    };
    if (showJobSelector) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showJobSelector]);

  useEffect(() => {
    if (open && candidate) {
      setLeftTab('attachment');
      setActiveJobIndex(0);
      setShowJobSelector(false);
      setShowStageDropdown(false);
      fetchData(candidate.id);
    }
  }, [open, candidate?.id, refreshKey]);

  const fetchData = async (candidateId: string) => {
    setLoading(true);
    try {
      const [fuData, pipelineData, resumeData, portfolioData] = await Promise.all([
        api.followUps.list(candidateId).catch(() => []),
        api.pipeline.getPipelineByCandidate(candidateId).catch(() => []),
        api.resumeParser.list(candidateId).catch(() => []),
        api.portfolio.list(candidateId).catch(() => []),
      ]);
      setFollowUps(fuData);
      setPipelineHistory(pipelineData);
      setResumes(resumeData);
      setPortfolios(portfolioData);
      const stagesPromises = pipelineData
        .filter((p) => p.status === 'active' && p.jobId)
        .map(async (p) => {
          const s = await api.pipeline.getStagesByJob(p.jobId!).catch(() => []);
          return { jobId: p.jobId!, stages: s as { id: string; name: string }[] };
        });
      const stagesResults = await Promise.all(stagesPromises);
      const map: Record<string, { id: string; name: string }[]> = {};
      stagesResults.forEach((r) => { map[r.jobId] = r.stages; });
      setStagesMap(map);
    } catch (err) {
      notify.error('Failed to fetch candidate data');
    } finally {
      setLoading(false);
    }
  };

  const jobPipelines = pipelineHistory.filter((p) => p.jobId);
  const sortedJobPipelines = [...jobPipelines].sort((a, b) => {
    if (!a.enteredAt) return 1;
    if (!b.enteredAt) return -1;
    return new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime();
  });
  const activeJobPipeline = sortedJobPipelines[activeJobIndex] || null;

  const handleMoveToStage = async (pipelineId: string, stageId: string) => {
    setActionLoading(pipelineId);
    try {
      await api.pipeline.moveToStage(pipelineId, stageId);
      await fetchData(candidate!.id);
      setShowStageDropdown(false);
    } catch (err) {
      alert('推进阶段失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (pipelineId: string) => {
    if (!await confirm('确定要淘汰该候选人吗？')) return;
    setActionLoading(pipelineId);
    try {
      await api.pipeline.rejectCandidate(pipelineId);
      await fetchData(candidate!.id);
    } catch (err) {
      alert('淘汰失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePool = async (pipelineId: string) => {
    setActionLoading(pipelineId);
    try {
      await api.pipeline.poolCandidate(pipelineId);
      await fetchData(candidate!.id);
    } catch (err) {
      alert('入库失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFromJob = async (pipelineId: string) => {
    if (!await confirm('确定要从该职位移除吗？')) return;
    setActionLoading(pipelineId);
    try {
      await api.pipeline.removeFromJob(pipelineId);
      await fetchData(candidate!.id);
      if (activeJobIndex >= sortedJobPipelines.length - 1) {
        setActiveJobIndex(Math.max(0, sortedJobPipelines.length - 2));
      }
    } catch (err) {
      alert('移除失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Portfolio Handlers ──────────────────────────

  const handleUploadPortfolio = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        multiple: false,
        filters: [
          { name: '文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'docx', 'doc', 'zip'] },
        ],
      }) as string | null;

      if (!filePath) return;

      setPortfolioLoading(true);
      const item = await api.portfolio.uploadFile(candidate!.id, filePath);
      setPortfolios((prev) => [item, ...prev]);
      notify.success('作品集上传成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify.error(`上传失败: ${msg}`);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !linkName.trim() || !candidate) return;
    try {
      setPortfolioLoading(true);
      const item = await api.portfolio.addLink(
        candidate.id,
        linkUrl.trim(),
        linkName.trim(),
        linkDesc.trim() || undefined,
      );
      setPortfolios((prev) => [item, ...prev]);
      setShowAddLink(false);
      setLinkUrl('');
      setLinkName('');
      setLinkDesc('');
      notify.success('链接已添加');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify.error(`添加失败: ${msg}`);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    const ok = await confirm('确定删除该作品集项目吗？');
    if (!ok) return;
    try {
      await api.portfolio.delete(id);
      setPortfolios((prev) => prev.filter((p) => p.id !== id));
      notify.success('已删除');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify.error(`删除失败: ${msg}`);
    }
  };

  if (!open || !candidate) return null;

  const sourceLabel: Record<string, string> = { manual: '手动录入', import: '批量导入', referral: '内部推荐' };
  let parsedResumeData: any = null;
  try { if (resumes.length > 0 && resumes[0].parsedJson) parsedResumeData = JSON.parse(resumes[0].parsedJson); } catch {}
  // Work experiences: prefer parsedJson, fallback to candidate field
  let workExperiences: any[] = [];
  try { workExperiences = parsedResumeData?.workExperiences || parsedResumeData?.work_experiences || JSON.parse(candidate.workExperiences || '[]'); } catch {}
  // Education history: prefer parsedJson, fallback to candidate field
  let educationHistory: any[] = [];
  try { educationHistory = parsedResumeData?.educationHistory || parsedResumeData?.education_history || JSON.parse(candidate.educationHistory || '[]'); } catch {}
  const selfIntroduction = parsedResumeData?.selfIntroduction || parsedResumeData?.summary || '';

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };
  const formatDuration = (enteredAt: string | null) => {
    if (!enteredAt) return '';
    const days = Math.floor((Date.now() - new Date(enteredAt).getTime()) / 86400000);
    if (days < 1) return '今天';
    if (days < 30) return `${days}天前`;
    return `${Math.floor(days / 30)}月前`;
  };

  // ==================== RENDER ====================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1d24] w-full h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">

          {/* ═══ LEFT COLUMN (60%) ═══ */}
          <div className="w-[60%] min-w-[480px] border-r border-[#2a2d35] flex flex-col overflow-hidden">

            {/* Top Info */}
            <div className="p-5 border-b border-[#2a2d35] shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex gap-3.5">
                  <div className="w-[52px] h-[52px] rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0">
                    {candidate.avatarUrl ? (
                      <img src={candidate.avatarUrl} alt={candidate.name} className="w-[52px] h-[52px] rounded-full object-cover" />
                    ) : (
                      <span className="text-xl font-medium text-[#3b82f6]">{candidate.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[17px] font-medium text-[#e2e8f0]">{candidate.name}</span>
                      {candidate.isStarred && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                    </div>
                    <div className="text-[13px] text-[#94a3b8] mt-0.5">
                      {candidate.currentCompany && <span>{candidate.currentCompany}</span>}
                      {candidate.currentPosition && <span>{candidate.currentCompany ? ' · ' : ''}{candidate.currentPosition}</span>}
                      {candidate.yearsExp != null && <span>{(candidate.currentCompany || candidate.currentPosition) ? ' · ' : ''}{candidate.yearsExp}年经验</span>}
                    </div>
                    {candidateTags.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {candidateTags.slice(0, 4).map((tag) => (
                          <span key={tag.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#2a2d35] text-[#64748b]"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[13px]">
                {candidate.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#64748b] shrink-0" /><span className="text-[#e2e8f0]">{candidate.phone}</span></div>}
                {candidate.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#64748b] shrink-0" /><span className="text-[#94a3b8] truncate">{candidate.email}</span></div>}
                {workExperiences.length > 0 && (
                  <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#64748b] shrink-0" /><span className="text-[#e2e8f0]">{workExperiences[0].company} · {workExperiences[0].position}{workExperiences[0].duration ? ` (${workExperiences[0].duration})` : ''}</span></div>
                )}
                {educationHistory.length > 0 ? (
                  <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#64748b] shrink-0" /><span className="text-[#e2e8f0]">{educationHistory[0].school || ''}{educationHistory[0].major ? ` · ${educationHistory[0].major}` : ''}{educationHistory[0].duration ? ` (${educationHistory[0].duration})` : ''}</span></div>
                ) : candidate.school ? (
                  <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#64748b] shrink-0" /><span className="text-[#e2e8f0]">{candidate.school}{candidate.major ? ` · ${candidate.major}` : ''}</span></div>
                ) : candidate.education ? (
                  <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#64748b] shrink-0" /><span className="text-[#e2e8f0]">{candidate.education}</span></div>
                ) : null}
                {candidate.expectedCity && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#64748b] shrink-0" /><span className="text-[#e2e8f0]">意向: {candidate.expectedCity}</span></div>}
              </div>
            </div>

            {/* Left Tabs */}
            <div className="flex border-b border-[#2a2d35] px-5 shrink-0">
              {([
                { key: 'attachment' as LeftTab, label: '附件简历', icon: FileText },
                { key: 'standard' as LeftTab, label: '标准简历', icon: StickyNote },
                { key: 'extra' as LeftTab, label: '附加信息', icon: Tag },
              ]).map((tab) => (
                <button key={tab.key} onClick={() => setLeftTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${leftTab === tab.key ? 'border-[#3b82f6] text-[#3b82f6]' : 'border-transparent text-[#64748b] hover:text-[#e2e8f0]'}`}>
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Left Content */}
            <div className="flex-1 overflow-y-auto">
              {leftTab === 'attachment' && (
                <div className="h-full">
                  {resumes.length > 0 ? (
                    <ResumePreview filePath={resumes[0].filePath} fileName={resumes[0].fileName} fileType={resumes[0].fileType as ResumeFileType} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <FileText className="w-12 h-12 mb-3 text-[#2a2d35]" />
                      <p className="text-sm text-[#94a3b8]">暂无附件简历</p>
                      <p className="text-xs text-[#64748b] mt-1">请通过「新建人才」上传简历文件</p>
                    </div>
                  )}
                </div>
              )}

              {leftTab === 'standard' && (
                <div className="p-5 space-y-5">
                  {selfIntroduction && (
                    <div>
                      <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-2">自我介绍</h3>
                      <div className="text-[13px] leading-relaxed text-[#e2e8f0] bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]">{selfIntroduction}</div>
                    </div>
                  )}
                  {workExperiences.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">工作经历</h3>
                      <div className="relative pl-4 border-l-2 border-[#3b82f6]/30 space-y-4">
                        {workExperiences.map((we: any, idx: number) => (
                          <div key={idx} className="relative">
                            <div className="absolute left-[-21px] top-1.5 w-2 h-2 rounded-full bg-[#3b82f6]" />
                            <p className="text-[13px] font-medium text-[#e2e8f0]">{we.company} · {we.position}</p>
                            <p className="text-xs text-[#94a3b8] mt-0.5">{we.duration}</p>
                            {we.description && <p className="text-xs text-[#94a3b8] mt-1.5 whitespace-pre-wrap leading-relaxed">{we.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {educationHistory.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-2">教育经历</h3>
                      <div className="space-y-2">
                        {educationHistory.map((edu: any, idx: number) => (
                          <div key={idx} className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]">
                            <p className="text-[13px] font-medium text-[#e2e8f0]">{edu.school || edu.institution || '-'}</p>
                            <p className="text-xs text-[#94a3b8] mt-0.5">{edu.major || edu.degree || ''} {edu.duration || ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!selfIntroduction && workExperiences.length === 0 && educationHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <StickyNote className="w-10 h-10 mb-3 text-[#2a2d35]" />
                      <p className="text-sm text-[#94a3b8]">暂无标准简历数据</p>
                      <p className="text-xs text-[#64748b] mt-1">请上传简历并进行智能解析</p>
                    </div>
                  )}
                </div>
              )}

              {leftTab === 'extra' && (
                <div className="p-5 space-y-5">
                  <div>
                    <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">求职意向</h3>
                    <div className="grid grid-cols-2 gap-3 text-[13px]">
                      {candidate.expectedCity && <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]"><span className="text-[#64748b] text-xs">意向城市</span><p className="text-[#e2e8f0] mt-1">{candidate.expectedCity}</p></div>}
                      {candidate.expectedSalary && <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]"><span className="text-[#64748b] text-xs">期望薪资</span><p className="text-[#e2e8f0] mt-1">{candidate.expectedSalary}</p></div>}
                      {candidate.school && <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]"><span className="text-[#64748b] text-xs">毕业院校</span><p className="text-[#e2e8f0] mt-1">{candidate.school}</p></div>}
                      {candidate.major && <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]"><span className="text-[#64748b] text-xs">专业</span><p className="text-[#e2e8f0] mt-1">{candidate.major}</p></div>}
                      {candidate.graduationDate && <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]"><span className="text-[#64748b] text-xs">毕业时间</span><p className="text-[#e2e8f0] mt-1">{candidate.graduationDate}</p></div>}
                      {candidate.birthDate && <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d35]"><span className="text-[#64748b] text-xs">出生日期</span><p className="text-[#e2e8f0] mt-1">{candidate.birthDate}</p></div>}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider">作品集</h3>
                      <div className="flex items-center gap-1.5">
                        <button onClick={handleUploadPortfolio} disabled={portfolioLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors disabled:opacity-50">
                          {portfolioLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          上传文件
                        </button>
                        <button onClick={() => setShowAddLink(!showAddLink)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 transition-colors">
                          <Link className="w-3 h-3" />
                          添加链接
                        </button>
                      </div>
                    </div>

                    {/* Add link inline form */}
                    {showAddLink && (
                      <div className="mb-3 p-3 rounded-lg border border-[#2a2d35] bg-[#0f1117] space-y-2">
                        <input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="名称（如：个人网站）"
                          className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#2a2d35] bg-[#1a1d24] text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#10b981]/50" />
                        <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="URL 链接"
                          className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#2a2d35] bg-[#1a1d24] text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#10b981]/50" />
                        <input value={linkDesc} onChange={e => setLinkDesc(e.target.value)} placeholder="描述（可选）"
                          className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#2a2d35] bg-[#1a1d24] text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#10b981]/50" />
                        <div className="flex justify-end gap-2 pt-1">
                          <button onClick={() => { setShowAddLink(false); setLinkUrl(''); setLinkName(''); setLinkDesc(''); }}
                            className="px-2.5 py-1 text-[11px] text-[#94a3b8] hover:text-[#e2e8f0] transition-colors">取消</button>
                          <button onClick={handleAddLink} disabled={!linkUrl.trim() || !linkName.trim() || portfolioLoading}
                            className="px-3 py-1 text-[11px] rounded-md bg-[#10b981] text-white hover:bg-[#059669] disabled:opacity-50 transition-colors">
                            {portfolioLoading ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    )}

                    {portfolios.length === 0 && !showAddLink ? (
                      <div className="bg-[#0f1117] p-4 rounded-lg border border-[#2a2d35] border-dashed">
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <ImageIcon className="w-8 h-8 mb-2 text-[#2a2d35]" />
                          <p className="text-xs text-[#94a3b8]">暂无作品集</p>
                          <p className="text-[11px] text-[#64748b] mt-1">可上传作品截图/项目PDF，或添加作品链接</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {portfolios.map((item) => (
                          <div key={item.id} className="group relative bg-[#0f1117] rounded-lg border border-[#2a2d35] overflow-hidden">
                            {item.fileType === 'link' ? (
                              <a href={item.filePath} target="_blank" rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center py-5 px-3 text-center h-full hover:bg-[#1a1d24] transition-colors">
                                <ExternalLink className="w-6 h-6 mb-2 text-[#10b981]" />
                                <p className="text-xs text-[#e2e8f0] font-medium truncate max-w-full">{item.fileName}</p>
                                {item.description && <p className="text-[10px] text-[#64748b] mt-1 line-clamp-2">{item.description}</p>}
                              </a>
                            ) : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(item.fileType) ? (
                              <div className="relative">
                                <img
                                  src={`https://asset.localhost/${encodeURIComponent(item.filePath)}`}
                                  alt={item.fileName}
                                  className="w-full h-24 object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <p className="text-[10px] text-[#94a3b8] px-2 py-1 truncate">{item.fileName}</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-5 px-3 text-center">
                                <FileText className="w-6 h-6 mb-2 text-[#3b82f6]" />
                                <p className="text-xs text-[#e2e8f0] truncate max-w-full">{item.fileName}</p>
                              </div>
                            )}
                            <button onClick={() => handleDeletePortfolio(item.id)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">其他信息</h3>
                    <div className="bg-[#0f1117] rounded-lg border border-[#2a2d35] divide-y divide-[#2a2d35]">
                      <div className="flex justify-between px-3 py-2.5 text-[13px]"><span className="text-[#64748b]">来源</span><span className="text-[#e2e8f0]">{sourceLabel[candidate.source] ?? candidate.source}</span></div>
                      <div className="flex justify-between px-3 py-2.5 text-[13px]"><span className="text-[#64748b]">录入时间</span><span className="text-[#e2e8f0]">{new Date(candidate.createdAt).toLocaleDateString('zh-CN')}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN (40%) ═══ */}
          <div className="w-[40%] min-w-[320px] flex flex-col overflow-hidden">

            {/* Pipeline */}
            <div className="p-4 border-b border-[#2a2d35] shrink-0">
              <div className="relative" ref={jobSelectorRef}>
                {activeJobPipeline ? (
                  <>
                    <div className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-[#0f1117] transition-colors" onClick={() => setShowJobSelector(!showJobSelector)}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#3b82f6]/20 flex items-center justify-center"><Briefcase className="w-3.5 h-3.5 text-[#3b82f6]" /></div>
                        <div>
                          <div className="text-[13px] font-medium text-[#e2e8f0]">{activeJobPipeline.jobTitle || '职位'}</div>
                          <div className="text-[11px] text-[#94a3b8]">{STATUS_LABELS[activeJobPipeline.status]?.label || activeJobPipeline.status}{activeJobPipeline.currentStageName && ` · ${activeJobPipeline.currentStageName}`}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[#64748b]">
                        {sortedJobPipelines.length > 1 && <span className="text-[11px]">切换</span>}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showJobSelector ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {showJobSelector && sortedJobPipelines.length > 1 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f1117] border border-[#2a2d35] rounded-lg py-1 shadow-lg z-10">
                        {sortedJobPipelines.map((entry, idx) => {
                          const isActive = idx === activeJobIndex;
                          const dotColor = entry.status === 'active' ? '#3b82f6' : entry.status === 'rejected' ? '#ef4444' : '#22c55e';
                          return (
                            <div key={entry.id} onClick={() => { setActiveJobIndex(idx); setShowJobSelector(false); setShowStageDropdown(false); }}
                              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${isActive ? 'bg-[#3b82f6]/10' : 'hover:bg-[#1a1d24]'}`}>
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-medium ${isActive ? 'text-[#3b82f6]' : 'text-[#e2e8f0]'}`}>{entry.jobTitle || '职位'}</div>
                                <div className="text-[10px] text-[#64748b]">{STATUS_LABELS[entry.status]?.label}{entry.enteredAt && ` · ${formatDuration(entry.enteredAt)}`}</div>
                              </div>
                              {isActive && <span className="text-[10px] text-[#3b82f6]">当前</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 text-[#2a2d35]" />
                    <p className="text-xs text-[#94a3b8] mb-3">暂未加入任何职位流程</p>
                    <button onClick={() => setRecommendOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b82f6] text-white text-xs font-medium hover:bg-[#2563eb] transition-colors"><UserPlus className="w-3.5 h-3.5" />推荐到职位</button>
                  </div>
                )}
              </div>

              {activeJobPipeline && (() => {
                const entry = activeJobPipeline;
                const jobStages = entry.jobId ? (stagesMap[entry.jobId] || []) : [];
                const currentStageIdx = jobStages.findIndex(s => s.id === entry.currentStageId);
                return (
                  <div className="space-y-3 mt-3">
                    {jobStages.length > 0 && entry.status === 'active' && (
                      <div className="flex items-center gap-0.5">
                        {jobStages.map((s, i) => {
                          const isPassed = i < currentStageIdx;
                          const isCurrent = i === currentStageIdx;
                          return (
                            <div key={s.id} className="flex-1 flex flex-col items-center gap-0.5">
                              <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-[#3b82f6] ring-2 ring-[#3b82f6]/30' : isPassed ? 'bg-[#3b82f6]/50' : 'bg-[#2a2d35]'}`} />
                              <span className={`text-[9px] text-center leading-tight ${isCurrent ? 'text-[#3b82f6] font-medium' : 'text-[#64748b]'}`}>{s.name.length > 4 ? s.name.slice(0, 4) + '..' : s.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {entry.status === 'active' && (
                      <div className="relative">
                        <button onClick={() => setShowStageDropdown(!showStageDropdown)} disabled={actionLoading === entry.id}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-50">
                          <ChevronRight className="w-3.5 h-3.5" />{actionLoading === entry.id ? '处理中...' : '推进阶段'}
                        </button>
                        {showStageDropdown && jobStages.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[#2a2d35] bg-[#1a1d24] shadow-lg z-10 max-h-40 overflow-y-auto">
                            {jobStages.map((stage) => (
                              <button key={stage.id} onClick={() => handleMoveToStage(entry.id, stage.id)}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#2a2d35] ${entry.currentStageId === stage.id ? 'text-[#3b82f6] font-medium' : 'text-[#e2e8f0]'}`}>
                                {stage.name}{entry.currentStageId === stage.id && <span className="text-[10px] text-[#64748b] ml-1">(当前)</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="bg-[#0f1117] rounded-lg p-2.5 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-[#64748b]">投递来源</span><span className="text-[#e2e8f0]">{sourceLabel[candidate.source] ?? candidate.source}</span></div>
                      <div className="flex justify-between"><span className="text-[#64748b]">进入时间</span><span className="text-[#e2e8f0]">{formatTime(entry.enteredAt)}</span></div>
                      {entry.interviewConclusion && <div className="flex justify-between"><span className="text-[#64748b]">面试结论</span><span className="text-[#e2e8f0]">{entry.interviewConclusion}</span></div>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-3 border-b border-[#2a2d35] flex gap-2 shrink-0">
              <button onClick={() => setFollowUpDialogOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#8b5cf6]/10 text-[#a78bfa] border border-[#8b5cf6]/30 text-xs font-medium hover:bg-[#8b5cf6]/20 transition-colors"><MessageSquare className="w-3.5 h-3.5" />快速跟进</button>
              <button onClick={() => setRecommendOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#3b82f6]/10 text-[#60a5fa] border border-[#3b82f6]/30 text-xs font-medium hover:bg-[#3b82f6]/20 transition-colors"><UserPlus className="w-3.5 h-3.5" />推荐职位</button>
              {activeJobPipeline?.status === 'active' && (
                <button onClick={() => handleReject(activeJobPipeline.id)} disabled={actionLoading === activeJobPipeline.id} className="px-3 py-2 rounded-lg bg-[#ef4444]/10 text-[#f87171] border border-[#ef4444]/30 text-xs font-medium hover:bg-[#ef4444]/20 transition-colors disabled:opacity-50">终止</button>
              )}
            </div>

            {/* Follow-up Records */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[#64748b] uppercase tracking-wider">跟进记录</span>
                {followUps.length > 3 && <span className="text-[11px] text-[#3b82f6] cursor-pointer hover:underline">查看全部</span>}
              </div>
              {followUps.length === 0 ? (
                <div className="text-center py-8"><MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#2a2d35]" /><p className="text-xs text-[#94a3b8]">暂无跟进记录</p></div>
              ) : (
                <div className="space-y-2">
                  {followUps.slice(0, 3).map((fu) => {
                    const typeColor = FOLLOW_TYPE_COLORS[fu.followType] || '#64748b';
                    return (
                      <div key={fu.id} className="bg-[#0f1117] p-2.5 rounded-lg border-l-[3px]" style={{ borderLeftColor: typeColor }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>{FOLLOW_TYPE_LABELS[fu.followType] || fu.followType}</span>
                          <span className="text-[11px] text-[#64748b]">{formatTime(fu.createdAt)}</span>
                        </div>
                        <p className="text-xs text-[#e2e8f0] leading-relaxed line-clamp-2">{fu.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {candidate && (
        <FollowUpDialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen} candidateId={candidate.id} candidateName={candidate.name}
          pipelineJobs={sortedJobPipelines.filter((p) => p.jobId && p.status === 'active').map((p) => ({ jobId: p.jobId!, jobTitle: p.jobTitle || '未命名职位' }))}
          onSuccess={() => { setFollowUpDialogOpen(false); setRefreshKey((k) => k + 1); }} />
      )}
      {candidate && (
        <RecommendToJobDialog open={recommendOpen} onOpenChange={setRecommendOpen} candidates={[candidate]}
          onSuccess={() => { setRecommendOpen(false); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}
