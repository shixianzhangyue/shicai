import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { CandidateWithPipeline, ResumeRecord } from '@/types';
import { CheckSquare, Square, Star, Briefcase, GraduationCap, Calendar, MessageSquare, XCircle } from 'lucide-react';

interface CandidateCardProps {
  candidate: CandidateWithPipeline;
  selected: boolean;
  onSelect: (pipelineId: string, selected: boolean) => void;
  onDetail: () => void;
  onFollowUp: () => void;
  onReject: (pipelineId: string) => void;
}

interface WorkExp {
  company?: string;
  position?: string;
  duration?: string;
  description?: string;
}

interface EduInfo {
  school?: string;
  institution?: string;
  major?: string;
  degree?: string;
  duration?: string;
}

export function CandidateCard({
  candidate,
  selected,
  onSelect,
  onDetail,
  onFollowUp,
  onReject,
}: CandidateCardProps) {
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);

  useEffect(() => {
    api.resumeParser.list(candidate.candidateId).then(setResumes).catch(() => {});
  }, [candidate.candidateId]);

  // Parse work experience and education from resume
  let workExps: WorkExp[] = [];
  let eduList: EduInfo[] = [];
  try {
    if (resumes.length > 0 && resumes[0].parsedJson) {
      const parsed = JSON.parse(resumes[0].parsedJson);
      workExps = parsed.workExperiences || [];
      eduList = parsed.educationHistory || [];
    }
  } catch {}

  // Fallback: try candidate fields
  if (workExps.length === 0 && candidate.workExperiences) {
    try { workExps = JSON.parse(candidate.workExperiences || '[]'); } catch {}
  }
  if (eduList.length === 0 && candidate.educationHistory) {
    try { eduList = JSON.parse(candidate.educationHistory || '[]'); } catch {}
  }

  const formatDate = (d: string | null) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }); } catch { return d; }
  };

  return (
    <div
      className="rounded-xl border border-[#2a2d35] bg-[#0f1117] p-4 hover:border-[#3b82f6]/30 transition-colors cursor-pointer"
      onClick={onDetail}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(candidate.pipelineId, !selected); }}
          className="mt-0.5 text-[#94a3b8] hover:text-[#3b82f6]"
        >
          {selected ? <CheckSquare className="w-4 h-4 text-[#3b82f6]" /> : <Square className="w-4 h-4" />}
        </button>

        <div className="w-9 h-9 rounded-full bg-[#2a2d35] flex items-center justify-center shrink-0">
          {candidate.avatarUrl ? (
            <img src={candidate.avatarUrl} alt={candidate.name} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-[#e2e8f0]">{candidate.name.charAt(0)}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#e2e8f0]">{candidate.name}</span>
            {candidate.age && <span className="text-xs text-[#64748b]">{candidate.age}岁</span>}
            {candidate.yearsExp != null && (
              <span className="text-xs text-[#64748b]">· {candidate.yearsExp}年工作经验</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {candidate.status === 'active' && (
            <button
              onClick={() => onReject(candidate.pipelineId)}
              className="p-1.5 rounded-md text-[#94a3b8] hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="终止投递"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onFollowUp}
            className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#8b5cf6] hover:bg-[#8b5cf6]/10 transition-colors"
            title="备注"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Work experience */}
      {workExps.length > 0 && (
        <div className="mt-3 ml-12 space-y-1.5">
          {workExps.slice(0, 2).map((we, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-[#94a3b8]">
              <Briefcase className="w-3 h-3 shrink-0 text-[#64748b]" />
              <span className="truncate">{we.duration || ''}</span>
              <span className="text-[#64748b]">·</span>
              <span className="truncate">{we.company || ''} · {we.position || ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {eduList.length > 0 && (
        <div className="mt-1.5 ml-12">
          {eduList.slice(0, 1).map((edu, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-[#94a3b8]">
              <GraduationCap className="w-3 h-3 shrink-0 text-[#64748b]" />
              <span className="truncate">{edu.school || edu.institution || ''}</span>
              <span className="text-[#64748b]">·</span>
              <span className="truncate">{edu.major || edu.degree || ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline info */}
      <div className="mt-3 ml-12 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-[#94a3b8]">
          <Briefcase className="w-3 h-3 text-[#64748b]" />
          <span>投递职位: <span className="text-[#e2e8f0]">{candidate.jobTitle}</span></span>
        </div>
        {candidate.appliedAt && (
          <div className="flex items-center gap-1.5 text-[#94a3b8]">
            <Calendar className="w-3 h-3 text-[#64748b]" />
            <span>{formatDate(candidate.appliedAt)} 申请</span>
          </div>
        )}
      </div>

      {/* Stage */}
      <div className="mt-1.5 ml-12 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-[#94a3b8]">
          <span>面试结论: <span className="text-[#e2e8f0]">{candidate.currentStageName || '未安排'}</span></span>
        </div>
        {candidate.interviewConclusion && (
          <div className="flex items-center gap-1.5 text-[#94a3b8]">
            <span>最近备注: <span className="text-[#e2e8f0] truncate max-w-[150px]">{candidate.interviewConclusion}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
