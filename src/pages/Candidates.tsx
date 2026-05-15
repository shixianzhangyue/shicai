import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { useCandidateStore } from '@/stores/candidateStore';
import { useTagStore } from '@/stores/tagStore';
import type { Candidate, EducationLevel, CandidateSource } from '@/types';
import CandidateCard from '@/components/candidates/CandidateCard';
import CandidateForm from '@/components/candidates/CandidateForm';
import { CandidateDetail } from '@/components/candidates/CandidateDetail';
import { ImportDialog } from '@/components/candidates/ImportDialog';
import DeleteCandidateDialog from '@/components/candidates/DeleteCandidateDialog';
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

function Candidates() {
  const {
    candidates,
    loading,
    error,
    searchKeyword,
    filters,
    fetchCandidates,
    deleteCandidate,
    setSearchKeyword,
    setFilters,
    resetFilters,
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

  const confirmDelete = async () => {
    if (!deletingCandidate) return;
    await deleteCandidate(deletingCandidate.id);
    setDeleteDialogOpen(false);
    setDeletingCandidate(null);
  };

  return (
    <PageLayout title="候选人" description="管理候选人信息">
      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <Input
            placeholder="搜索姓名、手机号、邮箱、公司..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCandidates()}
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
            新建候选人
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

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 rounded-xl border border-[#2a2d35] bg-[#1a1d24]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#e2e8f0]">筛选条件</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
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
              onClick={fetchCandidates}
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
          <h2 className="text-lg font-medium text-[#e2e8f0] mb-2">暂无候选人</h2>
          <p className="text-sm text-[#94a3b8] mb-6">
            点击「新建候选人」添加第一位候选人
          </p>
          <Button
            onClick={() => {
              setEditingCandidate(null);
              setFormOpen(true);
            }}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建候选人
          </Button>
        </div>
      )}

      {/* Candidates Grid */}
      {candidates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onEdit={() => handleEdit(candidate)}
              onDelete={() => handleDelete(candidate)}
              onClick={handleViewDetail}
            />
          ))}
        </div>
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
    </PageLayout>
  );
}

export default Candidates;
