import { useState, useMemo } from 'react';
import { Search, Briefcase, ChevronRight } from 'lucide-react';
import type { JobWithCandidateCount } from '@/types';

interface JobSidebarProps {
  jobs: JobWithCandidateCount[];
  selectedJobId: string | null;
  onSelect: (jobId: string | null) => void;
  total: number;
}

export function JobSidebar({ jobs, selectedJobId, onSelect, total }: JobSidebarProps) {
  const [search, setSearch] = useState('');

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const kw = search.toLowerCase();
    return jobs.filter((j) => j.title.toLowerCase().includes(kw));
  }, [jobs, search]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => b.candidateCount - a.candidateCount);
  }, [filteredJobs]);

  return (
    <div className="w-[220px] min-w-[220px] border-r border-[#2a2d35] bg-[#0f1117] flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-[#2a2d35]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索职位"
            className="w-full h-8 pl-8 pr-3 rounded-md bg-[#1a1d24] border border-[#2a2d35] text-xs text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-[#3b82f6]/50"
          />
        </div>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* All jobs */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            selectedJobId === null
              ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
              : 'text-[#94a3b8] hover:bg-[#1a1d24] hover:text-[#e2e8f0]'
          }`}
        >
          <Briefcase className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">全部职位</span>
          <span className="text-xs text-[#64748b]">{total}</span>
        </button>

        {/* Individual jobs */}
        {sortedJobs.map((job) => (
          <button
            key={job.id}
            onClick={() => onSelect(job.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 pl-7 text-left text-sm transition-colors ${
              selectedJobId === job.id
                ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
                : 'text-[#94a3b8] hover:bg-[#1a1d24] hover:text-[#e2e8f0]'
            }`}
          >
            <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
            <span className="flex-1 truncate">{job.title}</span>
            <span className="text-xs text-[#64748b]">{job.candidateCount}</span>
          </button>
        ))}

        {filteredJobs.length === 0 && search && (
          <div className="px-3 py-4 text-center text-xs text-[#64748b]">
            无匹配职位
          </div>
        )}
      </div>
    </div>
  );
}
