import { useState, useEffect, useMemo, useCallback } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { useJobStore } from '@/stores/jobStore';
import { useTagStore } from '@/stores/tagStore';
import type { Job, JobStatus, JobTemplate } from '@/types';
import JobCard from '@/components/jobs/JobCard';
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

  const { fetchTags } = useTagStore();

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

      {/* Job grid */}
      {filteredJobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onEdit={openEditForm}
              onDuplicate={handleDuplicate}
              onDelete={openDeleteDialog}
              onStatusChange={handleStatusChange}
            />
          ))}
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
