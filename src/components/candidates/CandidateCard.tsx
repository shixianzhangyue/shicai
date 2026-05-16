import type { Candidate } from '@/types';
import { useTagStore } from '@/stores/tagStore';
import { Pencil, Trash2, Archive } from 'lucide-react';

interface CandidateCardProps {
  candidate: Candidate;
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
  onClick?: (candidate: Candidate) => void;
  showTalentPoolBadge?: boolean;
}

function CandidateCard({ candidate, onEdit, onDelete, onClick, showTalentPoolBadge }: CandidateCardProps) {
  const tags = useTagStore((s) => s.tags);
  const candidateTags = tags.filter((t) => candidate.tags.includes(t.id));

  const sourceLabel: Record<string, string> = {
    manual: '手动录入',
    import: '批量导入',
    referral: '内部推荐',
  };

  return (
    <div
      onClick={() => onClick?.(candidate)}
      className={`relative flex flex-col rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5 transition-colors hover:border-[#3b82f6]/30 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Talent Pool Badge */}
      {showTalentPoolBadge && candidate.inTalentPool && (
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#8b5cf6]/20 text-[#8b5cf6] border border-[#8b5cf6]/30">
            <Archive className="w-3 h-3" />
            人才池
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-[#e2e8f0] line-clamp-1" title={candidate.name}>
          {candidate.name}
        </h3>
        <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#2a2d35] text-[#94a3b8]">
          {sourceLabel[candidate.source] ?? candidate.source}
        </span>
      </div>

      {/* Meta info */}
      <div className="mb-3 space-y-1.5">
        {candidate.phone && (
          <p className="text-sm text-[#94a3b8]">
            <span className="text-[#64748b]">手机：</span>
            {candidate.phone}
          </p>
        )}
        {candidate.email && (
          <p className="text-sm text-[#94a3b8]">
            <span className="text-[#64748b]">邮箱：</span>
            {candidate.email}
          </p>
        )}
        {(candidate.currentCompany || candidate.currentPosition) && (
          <p className="text-sm text-[#94a3b8]">
            <span className="text-[#64748b]">在职：</span>
            {candidate.currentCompany}
            {candidate.currentCompany && candidate.currentPosition && ' · '}
            {candidate.currentPosition}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {candidate.education && (
            <p className="text-sm text-[#94a3b8]">
              <span className="text-[#64748b]">学历：</span>
              {candidate.education}
            </p>
          )}
          {candidate.yearsExp !== null && candidate.yearsExp !== undefined && (
            <p className="text-sm text-[#94a3b8]">
              <span className="text-[#64748b]">年限：</span>
              {candidate.yearsExp} 年
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {candidateTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {candidateTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center justify-end gap-1 pt-3 border-t border-[#2a2d35]">
        <button
          onClick={() => onEdit(candidate)}
          className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
          title="编辑"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(candidate)}
          className="p-1.5 rounded-md text-[#94a3b8] hover:text-red-400 hover:bg-[#2a2d35] transition-colors"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default CandidateCard;
