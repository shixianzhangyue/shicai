import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { useJobStore } from '@/stores/jobStore';
import { useTagStore } from '@/stores/tagStore';
import type { Job, JobStatus, JobTemplate } from '@/types';
import JobForm from '@/components/jobs/JobForm';
import DeleteJobDialog from '@/components/jobs/DeleteJobDialog';
import TemplateManager from '@/components/jobs/TemplateManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Briefcase,
  Plus,
  Search,
  Loader2,
  FileText,
  Settings,
  Pencil,
  Trash2,
  Copy,
  MoreHorizontal,
} from 'lucide-react';

const STATUS_OPTIONS: { value: JobStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'open', label: '开放' },
  { value: 'paused', label: '暂停' },
  { value: 'closed', label: '关闭' },
];

function Jobs() {
  const {
    jobs,
    loading,
    error,
    searchKeyword,
    statusFilter,
    fetchJobs,
    deleteJob,
    duplicateJob,
    updateJobStatus,
    setSearchKeyword,
    setStatusFilter,
  } = useJobStore();

  const { tags, fetchTags } = useTagStore();
  const [searchParams] = useSearchParams();

  // Read status from URL params (e.g. from dashboard "在招职位" card)
  useEffect(() => {
    const status = searchParams.get('status');
    if (status && ['draft', 'open', 'paused', 'closed'].includes(status)) {
      setStatusFilter(status as JobStatus);
    }
  }, [searchParams, setStatusFilter]);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingJob, setDeletingJob] = useState<Job | null>(null);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);

  useEffect(() => {
    fetchJobs();
    fetchTags();
  }, [fetchJobs, fetchTags]);

  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(kw) ||
          (j.department && j.department.toLowerCase().includes(kw))
      );
    }
    if (statusFilter) {
      result = result.filter((j) => j.status === statusFilter);
    }
    return result;
  }, [jobs, searchKeyword, statusFilter]);

  const openCreateForm = useCallback(() => {
    setEditingJob(null);
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((job: Job) => {
    setEditingJob(job);
    setFormOpen(true);
  }, []);

  const openDeleteDialog = useCallback((job: Job) => {
    setDeletingJob(job);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingJob) return;
    try {
      await deleteJob(deletingJob.id);
    } catch {
      // error is already handled in store
    }
    setDeleteDialogOpen(false);
    setDeletingJob(null);
  }, [deletingJob, deleteJob]);

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        await duplicateJob(id);
      } catch {
        // error is already handled in store
      }
    },
    [duplicateJob]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: JobStatus) => {
      try {
        await updateJobStatus(id, status);
      } catch {
        // error is already handled in store
      }
    },
    [updateJobStatus]
  );

  return (
    <PageLayout title="职位管理" description="管理所有招聘职位，跟踪招聘进度">
      {/* Top action bar */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索职位或部门..."
              className="pl-9"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value as JobStatus) || null)
            }
            className="h-10 w-full sm:w-40 rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="inline-flex items-center gap-2">
                <Settings className="w-4 h-4" />
                模板管理
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>职位模板</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTemplateManagerOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                管理模板
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            新建职位
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && jobs.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
          <span className="ml-3 text-sm text-[#94a3b8]">加载中...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredJobs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2d35] bg-[#1a1d24] py-16">
          <Briefcase className="w-12 h-12 mb-4 text-[#3b82f6]" />
          <h2 className="text-lg font-medium text-[#e2e8f0] mb-2">
            {searchKeyword || statusFilter
              ? '未找到匹配的职位'
              : '暂无职位'}
          </h2>
          <p className="text-sm text-[#94a3b8] mb-6">
            {searchKeyword || statusFilter
              ? '请尝试调整搜索条件或筛选器'
              : '点击新建职位开始管理招聘需求'}
          </p>
          {!searchKeyword && !statusFilter && (
            <Button
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              新建职位
            </Button>
          )}
        </div>
      )}

      {/* Job Table */}
      {filteredJobs.length > 0 && (
        <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d35] bg-[#0f1117]">
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">职位名称</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">部门</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">薪资范围</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">招聘人数</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">状态</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">标签</th>
                <th className="px-4 py-3 text-right font-medium text-[#94a3b8]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => {
                const jobTags = tags.filter((t) => job.tags.includes(t.id));
                const statusConfig: Record<string, { label: string; color: string }> = {
                  draft: { label: '草稿', color: 'bg-gray-500/20 text-gray-400' },
                  open: { label: '开放', color: 'bg-green-500/20 text-green-400' },
                  paused: { label: '暂停', color: 'bg-yellow-500/20 text-yellow-400' },
                  closed: { label: '关闭', color: 'bg-red-500/20 text-red-400' },
                };
                const st = statusConfig[job.status] || statusConfig.draft;
                const formatSalary = (min: number | null, max: number | null) => {
                  if (min != null && max != null) return `${min}k-${max}k`;
                  if (min != null) return `${min}k起`;
                  if (max != null) return `最高${max}k`;
                  return '面议';
                };
                return (
                  <tr key={job.id} className="border-b border-[#2a2d35] last:border-0 hover:bg-[#22252d] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#e2e8f0]">{job.title}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{job.department || '-'}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{formatSalary(job.salaryMin, job.salaryMax)}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{job.headcount ?? 1} 人</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {jobTags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {jobTags.length > 2 && (
                          <span className="text-[10px] text-[#64748b]">+{jobTags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditForm(job)}
                          className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(job.id)}
                          className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
                          title="复制"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(job)}
                          className="p-1.5 rounded-md text-[#94a3b8] hover:text-red-400 hover:bg-[#2a2d35] transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="relative group">
                          <button className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors" title="切换状态">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-20 w-28 rounded-lg border border-[#2a2d35] bg-[#1a1d24] py-1 shadow-lg">
                            {STATUS_OPTIONS.filter(o => o.value).map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => handleStatusChange(job.id, opt.value as JobStatus)}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* JobForm Dialog */}
      <JobForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingJob={editingJob}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteJobDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        job={deletingJob}
        onConfirm={handleConfirmDelete}
      />

      {/* Template Manager Dialog */}
      <TemplateManager
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
      />
    </PageLayout>
  );
}

export default Jobs;
