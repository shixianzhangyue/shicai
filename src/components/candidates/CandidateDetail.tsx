import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Candidate, FollowUp, PipelineEntry } from '@/types';
import { useTagStore } from '@/stores/tagStore';
import {
  X, User, Phone, Mail, Building2, GraduationCap, Clock, Tag,
  FileText, Link2, Briefcase, Calendar, MapPin, Loader2
} from 'lucide-react';
import { RelationsTab } from './RelationsTab';
import { ResumePreview } from './ResumePreview';

interface CandidateDetailProps {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
}

const FOLLOW_TYPE_LABELS: Record<string, string> = {
  phone: '电话', wechat: '微信', meeting: '面谈', email: '邮件', other: '其他',
};

const FOLLOW_RESULT_LABELS: Record<string, { label: string; color: string }> = {
  positive: { label: '意向积极', color: 'text-green-400 bg-green-400/10' },
  neutral: { label: '意向一般', color: 'text-yellow-400 bg-yellow-400/10' },
  declined: { label: '暂不考虑', color: 'text-gray-400 bg-gray-400/10' },
  accepted: { label: '已接受', color: 'text-blue-400 bg-blue-400/10' },
  rejected: { label: '已拒绝', color: 'text-red-400 bg-red-400/10' },
};

type DetailTab = 'overview' | 'followUps' | 'relations' | 'pipeline' | 'resume';

export function CandidateDetail({ candidate, open, onClose }: CandidateDetailProps) {
  const tags = useTagStore((s) => s.tags);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const candidateTags = tags.filter((t) => candidate?.tags.includes(t.id));

  useEffect(() => {
    if (open && candidate) {
      setActiveTab('overview');
      fetchData(candidate.id);
    }
  }, [open, candidate?.id]);

  const fetchData = async (candidateId: string) => {
    setLoading(true);
    try {
      const fuData = await api.followUps.list(candidateId).catch(() => []);
      setFollowUps(fuData);
      // TODO: add backend command `get_pipeline_by_candidate` to fetch pipeline history
      setPipelineHistory([]);
    } catch (err) {
      console.error('Failed to fetch candidate data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[560px] max-w-full h-full bg-[#1a1d24] border-l border-[#2a2d35] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d35]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
              <User className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e2e8f0]">{candidate.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {candidate.currentPosition && (
                  <span className="text-xs text-[#94a3b8]">{candidate.currentPosition}</span>
                )}
                {candidate.currentCompany && (
                  <>
                    <span className="text-[#64748b]">·</span>
                    <span className="text-xs text-[#94a3b8]">{candidate.currentCompany}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#2a2d35] text-[#94a3b8]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-[#2a2d35]">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { key: 'overview' as DetailTab, label: '概览', icon: User },
              { key: 'followUps' as DetailTab, label: '跟进', icon: FileText, count: followUps.length },
              { key: 'relations' as DetailTab, label: '关系', icon: Link2 },
              { key: 'pipeline' as DetailTab, label: '应聘', icon: Briefcase },
              { key: 'resume' as DetailTab, label: '简历', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[#3b82f6] text-[#3b82f6]'
                    : 'border-transparent text-[#94a3b8] hover:text-[#e2e8f0]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {'count' in tab && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#2a2d35] text-xs text-[#94a3b8]">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-5 space-y-5">
              {/* Basic Info Card */}
              <div className="rounded-xl border border-[#2a2d35] bg-[#0f1117] p-4">
                <h3 className="text-sm font-medium text-[#e2e8f0] mb-3">基本信息</h3>
                <div className="grid grid-cols-2 gap-3">
                  {candidate.phone && (
                    <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                      <Phone className="w-4 h-4 text-[#64748b]" />
                      {candidate.phone}
                    </div>
                  )}
                  {candidate.email && (
                    <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                      <Mail className="w-4 h-4 text-[#64748b]" />
                      {candidate.email}
                    </div>
                  )}
                  {candidate.currentCompany && (
                    <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                      <Building2 className="w-4 h-4 text-[#64748b]" />
                      {candidate.currentCompany}
                    </div>
                  )}
                  {candidate.education && (
                    <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                      <GraduationCap className="w-4 h-4 text-[#64748b]" />
                      {candidate.education}
                    </div>
                  )}
                  {candidate.yearsExp !== null && candidate.yearsExp !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                      <Clock className="w-4 h-4 text-[#64748b]" />
                      {candidate.yearsExp} 年经验
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                    <Tag className="w-4 h-4 text-[#64748b]" />
                    {{ manual: '手动录入', import: '批量导入', referral: '内部推荐' }[candidate.source] ?? candidate.source}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                    <Calendar className="w-4 h-4 text-[#64748b]" />
                    {new Date(candidate.createdAt).toLocaleDateString('zh-CN')} 录入
                  </div>
                </div>
              </div>

              {/* Tags */}
              {candidateTags.length > 0 && (
                <div className="rounded-xl border border-[#2a2d35] bg-[#0f1117] p-4">
                  <h3 className="text-sm font-medium text-[#e2e8f0] mb-3">标签</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {candidateTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#2a2d35] bg-[#0f1117] p-3 text-center">
                  <p className="text-xl font-bold text-[#3b82f6]">{followUps.length}</p>
                  <p className="text-xs text-[#94a3b8] mt-1">跟进记录</p>
                </div>
                <div className="rounded-xl border border-[#2a2d35] bg-[#0f1117] p-3 text-center">
                  <p className="text-xl font-bold text-green-400">{pipelineHistory.length}</p>
                  <p className="text-xs text-[#94a3b8] mt-1">应聘职位</p>
                </div>
                <div className="rounded-xl border border-[#2a2d35] bg-[#0f1117] p-3 text-center">
                  <p className="text-xl font-bold text-amber-400">-</p>
                  <p className="text-xs text-[#94a3b8] mt-1">简历状态</p>
                </div>
              </div>
            </div>
          )}

          {/* Follow-ups Tab */}
          {activeTab === 'followUps' && (
            <div className="p-5 space-y-3">
              {loading ? (
                <div className="py-8 text-center text-sm text-[#94a3b8]">加载中...</div>
              ) : followUps.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-[#2a2d35]" />
                  <p className="text-sm text-[#94a3b8]">暂无跟进记录</p>
                </div>
              ) : (
                <div className="relative pl-4 border-l border-[#2a2d35] space-y-4">
                  {followUps.map((fu, idx) => (
                    <div key={fu.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#3b82f6] ring-4 ring-[#1a1d24]" />
                      <div className="p-3 rounded-lg border border-[#2a2d35] bg-[#0f1117]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#2a2d35] text-[#94a3b8]">
                              {FOLLOW_TYPE_LABELS[fu.followType] ?? fu.followType}
                            </span>
                            {fu.result && FOLLOW_RESULT_LABELS[fu.result] && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${FOLLOW_RESULT_LABELS[fu.result].color}`}>
                                {FOLLOW_RESULT_LABELS[fu.result].label}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#64748b]">
                            {new Date(fu.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-sm text-[#e2e8f0]">{fu.content}</p>
                        {fu.nextFollowDate && (
                          <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            下次跟进：{fu.nextFollowDate}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Relations Tab */}
          {activeTab === 'relations' && (
            <div className="p-5">
              <RelationsTab candidateId={candidate.id} />
            </div>
          )}

          {/* Pipeline Tab */}
          {activeTab === 'pipeline' && (
            <div className="p-5">
              {pipelineHistory.length === 0 ? (
                <div className="py-8 text-center">
                  <Briefcase className="w-10 h-10 mx-auto mb-3 text-[#2a2d35]" />
                  <p className="text-sm text-[#94a3b8]">暂无应聘记录</p>
                  <p className="text-xs text-[#64748b] mt-1">该候选人尚未加入任何职位流程</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pipelineHistory.map((entry) => (
                    <div key={entry.id} className="p-3 rounded-lg border border-[#2a2d35] bg-[#0f1117]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#e2e8f0]">{entry.currentStageName || '未分配阶段'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          entry.status === 'active' ? 'bg-green-400/10 text-green-400' :
                          entry.status === 'rejected' ? 'bg-red-400/10 text-red-400' :
                          'bg-[#2a2d35] text-[#94a3b8]'
                        }`}>
                          {entry.status === 'active' ? '进行中' : entry.status === 'rejected' ? '已淘汰' : '人才库'}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748b] mt-1">
                        进入时间：{new Date(entry.enteredAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resume Tab */}
          {activeTab === 'resume' && (
            <div className="h-full">
              <ResumePreview filePath={null} fileName={null} fileType={null} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
