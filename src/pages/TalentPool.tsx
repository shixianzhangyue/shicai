import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { useCandidateStore } from '@/stores/candidateStore';
import { useTagStore } from '@/stores/tagStore';
import { api } from '@/lib/api';
import type { Candidate, EducationLevel, CandidateSource } from '@/types';
import CandidateForm from '@/components/candidates/CandidateForm';
import { CandidateDetail } from '@/components/candidates/CandidateDetail';
import { ImportDialog } from '@/components/candidates/ImportDialog';
import DeleteCandidateDialog from '@/components/candidates/DeleteCandidateDialog';
import { RecommendToJobDialog } from '@/components/candidates/RecommendToJobDialog';
import { FollowUpDialog } from '@/components/candidates/FollowUpDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Plus,
  Search,
  Loader2,
  Filter,
  X,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserPlus,
  CheckSquare,
  Square,
  Pencil,
  Trash2,
  MoreHorizontal,
  MessageSquare,
} from 'lucide-react';

const EDUCATION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部学历' },
  { value: '高中', label: '高中' },
  { value: '大专', label: '大专' },
  { value: '本科', label: '本科' },
  { value: '硕士', label: '硕士' },
  { value: '博士', label: '博士' },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部来源' },
  { value: 'manual', label: '手动录入' },
  { value: 'import', label: '批量导入' },
  { value: 'referral', label: '内推' },
];

type SortField = 'name' | 'created_at' | 'updated_at' | 'years_exp';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'created_at', label: '创建时间' },
  { value: 'updated_at', label: '更新时间' },
  { value: 'name', label: '姓名' },
  { value: 'years_exp', label: '工作经验' },
];

function TalentPool() {
  const {
    candidates,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    searchKeyword,
    filters,
    sortBy,
    sortOrder,
    fetchCandidates,
    deleteCandidate,
    setSearchKeyword,
    setFilters,
    resetFilters,
    setSortBy,
    toggleSortOrder,
    setPage,
    setPageSize,
  } = useCandidateStore();

  const { tags, fetchTags } = useTagStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCandidate, setDeletingCandidate] = useState<Candidate | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [recommendSingle, setRecommendSingle] = useState<Candidate | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<Candidate | null>(null);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpPipelineJobs, setFollowUpPipelineJobs] = useState<{ jobId: string; jobTitle: string }[]>([]);

  useEffect(() => {
    fetchCandidates();
    fetchTags();
  }, [fetchCandidates, fetchTags]);

  // Handle URL query param for candidate detail (from TodayFollowUpsPanel)
  useEffect(() => {
    const candidateId = searchParams.get('id');
    if (candidateId && candidates.length > 0) {
      const candidate = candidates.find((c) => c.id === candidateId);
      if (candidate) {
        setDetailCandidate(candidate);
        setDetailOpen(true);
        // Clean up URL param
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, candidates, setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.tags.length > 0 ||
      filters.education ||
      filters.minExp !== null ||
      filters.maxExp !== null ||
      filters.source
    );
  }, [filters]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchKeyword(value);
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    const timeout = setTimeout(() => {
      fetchCandidates();
    }, 300);
    setSearchDebounce(timeout);
  }, [searchDebounce, setSearchKeyword, fetchCandidates]);

  const handleEdit = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setFormOpen(true);
  };

  const handleDelete = (candidate: Candidate) => {
    setDeletingCandidate(candidate);
    setDeleteDialogOpen(true);
  };

  const handleViewDetail = (candidate: Candidate) => {
    setDetailCandidate(candidate);
    setDetailOpen(true);
  };

  const handleOpenFollowUp = async (candidate: Candidate) => {
    setFollowUpTarget(candidate);
    try {
      const pipelines = await api.pipeline.getPipelineByCandidate(candidate.id);
      const jobs = pipelines
        .filter((p) => p.jobId && p.status === 'active')
        .map((p) => ({ jobId: p.jobId!, jobTitle: p.jobTitle || '未命名职位' }));
      setFollowUpPipelineJobs(jobs);
    } catch {
      setFollowUpPipelineJobs([]);
    }
    setFollowUpDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingCandidate) return;
    await deleteCandidate(deletingCandidate.id);
    setDeleteDialogOpen(false);
    setDeletingCandidate(null);
  };

  const handleApplyFilters = () => {
    fetchCandidates();
  };

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.size === candidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(candidates.map((c) => c.id)));
    }
  };

  const getSelectedCandidatesList = (): Candidate[] => {
    return candidates.filter((c) => selectedCandidates.has(c.id));
  };

  const clearSelection = () => {
    setSelectedCandidates(new Set());
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#2a2d35]">
        <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
          <span>共 {total} 条</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 px-2 rounded bg-[#1a1d24] border border-[#2a2d35] text-[#e2e8f0]"
          >
            <option value={10}>10 条/页</option>
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="h-8 w-8 p-0 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="h-8 w-8 p-0 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {startPage > 1 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                className="h-8 w-8 p-0 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
              >
                1
              </Button>
              {startPage > 2 && <span className="text-[#94a3b8]">...</span>}
            </>
          )}

          {pageNumbers.map((num) => (
            <Button
              key={num}
              variant={num === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPage(num)}
              className={`h-8 w-8 p-0 ${
                num === page
                  ? 'bg-[#3b82f6] text-white'
                  : 'border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]'
              }`}
            >
              {num}
            </Button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="text-[#94a3b8]">...</span>}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                className="h-8 w-8 p-0 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
              >
                {totalPages}
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="h-8 w-8 p-0 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="h-8 w-8 p-0 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <PageLayout
      title="人才库"
      description="储备人才资源池，支持推荐到职位"
    >
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <Input
            placeholder="搜索姓名、手机号、邮箱、公司..."
            value={searchKeyword}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0] placeholder:text-[#64748b]"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] ${
              hasActiveFilters ? 'border-[#3b82f6]/50 text-[#3b82f6]' : ''
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            筛选
            {hasActiveFilters && (
              <span className="ml-2 w-2 h-2 rounded-full bg-[#3b82f6]" />
            )}
          </Button>
          <Button
            onClick={() => {
              setEditingCandidate(null);
              setFormOpen(true);
            }}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建人才
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            <Upload className="w-4 h-4 mr-2" />
            批量导入
          </Button>
        </div>
      </div>

      {/* Sort Controls & Selection Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#94a3b8]">排序：</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="h-8 px-2 rounded bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSortOrder}
            className="h-8 px-2 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            {sortOrder === 'asc' ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Selection Actions */}
        {candidates.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="h-8 border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
            >
              {selectedCandidates.size === candidates.length ? (
                <>
                  <CheckSquare className="w-4 h-4 mr-1" />
                  取消全选
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-1" />
                  全选
                </>
              )}
            </Button>
            {selectedCandidates.size > 0 && (
              <>
                <span className="text-sm text-[#94a3b8]">
                  已选 {selectedCandidates.size} 人
                </span>
                <Button
                  size="sm"
                  onClick={() => setRecommendOpen(true)}
                  className="h-8 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  推荐到职位
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-8 text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 rounded-xl border border-[#2a2d35] bg-[#1a1d24]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#e2e8f0]">筛选条件</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetFilters();
                  fetchCandidates();
                }}
                className="text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                <X className="w-3 h-3 mr-1" />
                重置
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tags */}
            <div>
              <label className="text-xs text-[#94a3b8] mb-1.5 block">标签</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      const newTags = filters.tags.includes(tag.name)
                        ? filters.tags.filter((t) => t !== tag.name)
                        : [...filters.tags, tag.name];
                      setFilters({ tags: newTags });
                    }}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      filters.tags.includes(tag.name)
                        ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50'
                        : 'bg-[#2a2d35] text-[#94a3b8] border border-[#2a2d35] hover:border-[#3b82f6]/30'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Education */}
            <div>
              <label className="text-xs text-[#94a3b8] mb-1.5 block">学历</label>
              <select
                value={filters.education || ''}
                onChange={(e) => setFilters({ education: e.target.value || null })}
                className="w-full h-9 px-3 rounded-md bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0]"
              >
                {EDUCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Range */}
            <div>
              <label className="text-xs text-[#94a3b8] mb-1.5 block">经验范围（年）</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="最小"
                  value={filters.minExp ?? ''}
                  onChange={(e) => setFilters({ minExp: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0]"
                />
                <span className="text-[#94a3b8]">-</span>
                <Input
                  type="number"
                  placeholder="最大"
                  value={filters.maxExp ?? ''}
                  onChange={(e) => setFilters({ maxExp: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0]"
                />
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="text-xs text-[#94a3b8] mb-1.5 block">来源</label>
              <select
                value={filters.source || ''}
                onChange={(e) => setFilters({ source: e.target.value || null })}
                className="w-full h-9 px-3 rounded-md bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0]"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleApplyFilters}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              应用筛选
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && candidates.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
          <span className="ml-3 text-sm text-[#94a3b8]">加载中...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && candidates.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2d35] bg-[#1a1d24] py-16">
          <Users className="w-12 h-12 mb-4 text-[#3b82f6]" />
          <h2 className="text-lg font-medium text-[#e2e8f0] mb-2">人才库为空</h2>
          <p className="text-sm text-[#94a3b8] mb-6">
            点击「新建人才」添加第一位储备人才
          </p>
          <Button
            onClick={() => {
              setEditingCandidate(null);
              setFormOpen(true);
                }}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                新建人才
              </Button>
        </div>
      )}

      {/* Candidates Table */}
      {candidates.length > 0 && (
        <>
          <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d35] bg-[#0f1117]">
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        selectedCandidates.size === candidates.length && candidates.length > 0
                          ? 'bg-[#3b82f6] border-[#3b82f6] text-white'
                          : 'border-[#4a4d55] hover:border-[#3b82f6]'
                      }`}
                    >
                      {selectedCandidates.size === candidates.length && candidates.length > 0 && (
                        <CheckSquare className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">姓名</th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">手机号</th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">邮箱</th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">当前公司</th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">当前职位</th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">学历</th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">工作年限</th>
                  <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">来源</th>
                  <th className="px-4 py-3 text-right font-medium text-[#94a3b8]">操作</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => {
                  const candidateTags = tags.filter((t) => candidate.tags.includes(t.id));
                  const sourceLabel: Record<string, string> = {
                    manual: '手动录入',
                    import: '批量导入',
                    referral: '内部推荐',
                  };
                  return (
                    <tr
                      key={candidate.id}
                      className="border-b border-[#2a2d35] last:border-0 hover:bg-[#22252d] cursor-pointer transition-colors"
                      onClick={() => handleViewDetail(candidate)}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCandidateSelection(candidate.id);
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            selectedCandidates.has(candidate.id)
                              ? 'bg-[#3b82f6] border-[#3b82f6] text-white'
                              : 'border-[#4a4d55] hover:border-[#3b82f6]'
                          }`}
                        >
                          {selectedCandidates.has(candidate.id) && (
                            <CheckSquare className="w-3 h-3" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#e2e8f0]">{candidate.name}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{candidate.phone || '-'}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{candidate.email || '-'}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{candidate.currentCompany || '-'}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{candidate.currentPosition || '-'}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{candidate.education || '-'}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{candidate.yearsExp != null ? `${candidate.yearsExp}年` : '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#2a2d35] text-[#94a3b8]">
                          {sourceLabel[candidate.source] ?? candidate.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick follow-up */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFollowUp(candidate);
                            }}
                            className="p-1.5 rounded-md text-[#10b981] hover:text-[#34d399] hover:bg-[#10b981]/10 transition-colors"
                            title="快速跟进"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {/* More menu */}
                          <div className="relative group">
                            <button className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors" title="更多">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-20 w-36 rounded-lg border border-[#2a2d35] bg-[#1a1d24] py-1 shadow-lg">
                              <button
                                onClick={(e) => { e.stopPropagation(); setRecommendSingle(candidate); setRecommendOpen(true); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-[#8b5cf6]" />推荐到职位
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(candidate); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />编辑
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(candidate); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#2a2d35] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />删除
                              </button>
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

          {/* Pagination */}
          {renderPagination()}
        </>
      )}

      {/* Form Dialog */}
      <CandidateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingCandidate={editingCandidate}
      />

      {/* Delete Dialog */}
      <DeleteCandidateDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        candidate={deletingCandidate}
        onConfirm={confirmDelete}
      />

      {/* Candidate Detail Panel */}
      <CandidateDetail
        candidate={detailCandidate}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailCandidate(null);
        }}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          fetchCandidates();
          setImportOpen(false);
        }}
      />

      {/* Recommend to Job Dialog */}
      <RecommendToJobDialog
        open={recommendOpen}
        onOpenChange={(v) => { setRecommendOpen(v); if (!v) setRecommendSingle(null); }}
        candidates={recommendSingle ? [recommendSingle] : getSelectedCandidatesList()}
        onSuccess={() => {
          clearSelection();
          setRecommendSingle(null);
          fetchCandidates();
          // Don't close detail panel - CandidateDetail refreshes internally via refreshKey
        }}
      />

      {/* Follow-up Dialog */}
      {followUpTarget && (
        <FollowUpDialog
          open={followUpDialogOpen}
          onOpenChange={setFollowUpDialogOpen}
          candidateId={followUpTarget.id}
          candidateName={followUpTarget.name}
          pipelineJobs={followUpPipelineJobs}
          onSuccess={() => {
            setFollowUpDialogOpen(false);
            setFollowUpTarget(null);
            fetchCandidates();
          }}
        />
      )}
    </PageLayout>
  );
}

export default TalentPool;
