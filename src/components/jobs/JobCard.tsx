import type { Job, JobStatus } from '@/types';
import { useTagStore } from '@/stores/tagStore';
import JobStatusBadge from './JobStatusBadge';
import { Pencil, Trash2, Copy, MoreHorizontal } from 'lucide-react';

interface JobCardProps {
  job: Job;
  onEdit: (job: Job) => void;
  onDuplicate: (id: string) => void;
  onDelete: (job: Job) => void;
  onStatusChange: (id: string, status: JobStatus) => void;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'open', label: '开放' },
  { value: 'paused', label: '暂停' },
  { value: 'closed', label: '关闭' },
];

function formatSalary(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min}k-${max}k`;
  if (min != null) return `${min}k起`;
  if (max != null) return `最高${max}k`;
  return '面议';
}

function JobCard({ job, onEdit, onDuplicate, onDelete, onStatusChange }: JobCardProps) {
  const tags = useTagStore((s) => s.tags);

  const jobTags = tags.filter((t) => job.tags.includes(t.id));

  return (
    <div className="relative flex flex-col rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5 transition-colors hover:border-[#3b82f6]/30">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-[#e2e8f0] line-clamp-1" title={job.title}>
          {job.title}
        </h3>
        <JobStatusBadge status={job.status} />
      </div>

      {/* Meta */}
      <div className="mb-3 space-y-1">
        {job.department && (
          <p className="text-sm text-[#94a3b8]">{job.department}</p>
        )}
        <p className="text-sm text-[#94a3b8]">
          薪资：{formatSalary(job.salaryMin, job.salaryMax)}
        </p>
        <p className="text-sm text-[#94a3b8]">
          招聘人数：{job.headcount ?? 1} 人
        </p>
      </div>

      {/* Tags */}
      {jobTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {jobTags.map((tag) => (
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
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-[#2a2d35]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(job)}
            className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
            title="编辑"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicate(job.id)}
            className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
            title="复制"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(job)}
            className="p-1.5 rounded-md text-[#94a3b8] hover:text-red-400 hover:bg-[#2a2d35] transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="relative group">
          <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors">
            <MoreHorizontal className="w-3.5 h-3.5" />
            切换状态
          </button>
          <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-20 w-28 rounded-lg border border-[#2a2d35] bg-[#1a1d24] py-1 shadow-lg">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStatusChange(job.id, opt.value)}
                className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-[#2a2d35] ${
                  job.status === opt.value
                    ? 'text-[#3b82f6] font-medium'
                    : 'text-[#e2e8f0]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobCard;
