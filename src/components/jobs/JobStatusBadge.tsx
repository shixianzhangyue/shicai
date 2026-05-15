import type { JobStatus } from '@/types';

interface JobStatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  open: { label: '开放', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  paused: { label: '暂停', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  closed: { label: '关闭', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

function JobStatusBadge({ status, className = '' }: JobStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
      style={{
        color: config.color,
        backgroundColor: config.bg,
      }}
    >
      {config.label}
    </span>
  );
}

export default JobStatusBadge;
