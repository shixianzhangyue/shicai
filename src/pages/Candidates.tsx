import { useState, useEffect, useCallback } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { api } from '@/lib/api';
import type { StageStat, CandidateWithPipeline, JobWithCandidateCount, PaginatedCandidateWithPipeline } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Search,
  Loader2,
  Filter,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Calendar,
  MessageSquare,
  CheckSquare,
  Square,
  MoreHorizontal,
  ArrowRight,
  X,
} from 'lucide-react';

function Candidates() {
  // State for stage stats
  const [stageStats, setStageStats] = useState<StageStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // State for stages list (for batch operations)
  const [stages, setStages] = useState<{id: string, name: string}[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);

  // State for job filter
  const [jobsWithCandidates, setJobsWithCandidates] = useState<JobWithCandidateCount[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [showJobFilter, setShowJobFilter] = useState(true);

  // State for candidates list
  const [candidates, setCandidates] = useState<CandidateWithPipeline[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // State for search and filter
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // State for batch operations
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Fetch stage stats
  const fetchStageStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const stats = await api.pipeline.getStageStats(selectedJobId);
      setStageStats(stats);
    } catch (err) {
      console.error('Failed to fetch stage stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedJobId]);

  // Fetch stages for batch operations
  const fetchStages = useCallback(async () => {
    if (!selectedJobId) {
      setStages([]);
      return;
    }
    setStagesLoading(true);
    try {
      const stagesList = await api.pipeline.getStagesByJob(selectedJobId);
      setStages(stagesList);
    } catch (err) {
      console.error('Failed to fetch stages:', err);
    } finally {
      setStagesLoading(false);
    }
  }, [selectedJobId]);

  // Fetch jobs with candidates
  const fetchJobsWithCandidates = useCallback(async () => {
    setJobsLoading(true);
    try {
      const jobs = await api.pipeline.getJobsWithCandidates();
      setJobsWithCandidates(jobs);
    } catch (err) {
      console.error('Failed to fetch jobs with candidates:', err);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Fetch candidates
  const fetchCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    try {
      const result: PaginatedCandidateWithPipeline = await api.pipeline.listCandidatesByJob({
        jobId: selectedJobId,
        stageId: selectedStageId,
        keyword: searchKeyword || undefined,
        page,
        pageSize,
      });
      setCandidates(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setCandidatesLoading(false);
    }
  }, [selectedJobId, selectedStageId, searchKeyword, page, pageSize]);

  // Load data on mount
  useEffect(() => {
    fetchJobsWithCandidates();
  }, [fetchJobsWithCandidates]);

  // Fetch stats and candidates when filters change
  useEffect(() => {
    fetchStageStats();
    fetchCandidates();
    fetchStages();
  }, [fetchStageStats, fetchCandidates, fetchStages]);

  // Handle job selection
  const handleJobSelect = (jobId: string | null) => {
    setSelectedJobId(jobId);
    setSelectedStageId(null);
    setPage(1);
  };

  // Handle stage selection
  const handleStageSelect = (stageName: string | null) => {
    setSelectedStageId(stageName);
    setPage(1);
  };

  // Handle search
  const handleSearch = () => {
    setPage(1);
    fetchCandidates();
  };

  // Handle candidate selection
  const handleCandidateSelect = (pipelineId: string, checked: boolean) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(pipelineId);
      } else {
        next.delete(pipelineId);
      }
      return next;
    });
  };

  // Handle select all candidates
  const handleSelectAll = () => {
    if (selectedCandidates.size === candidates.length && candidates.length > 0) {
      // Deselect all
      setSelectedCandidates(new Set());
    } else {
      // Select all
      const allIds = new Set(candidates.map((c) => c.pipelineId));
      setSelectedCandidates(allIds);
    }
  };

  // Handle batch move to stage
  const handleBatchMoveToStage = async (stageId: string) => {
    if (selectedCandidates.size === 0) return;
    setBatchActionLoading(true);
    try {
      await api.pipeline.batchMove(Array.from(selectedCandidates), stageId);
      setSelectedCandidates(new Set());
      await fetchCandidates();
      await fetchStageStats();
    } catch (err) {
      console.error('Batch move failed:', err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Handle batch reject
  const handleBatchReject = async () => {
    if (selectedCandidates.size === 0) return;
    setBatchActionLoading(true);
    try {
      await api.pipeline.batchReject(Array.from(selectedCandidates));
      setSelectedCandidates(new Set());
      await fetchCandidates();
      await fetchStageStats();
    } catch (err) {
      console.error('Batch reject failed:', err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedCandidates(new Set());
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get stage color based on stage name
  const getStageColor = (stageName: string) => {
    const colorMap: Record<string, string> = {
      '简历初筛': '#3b82f6',
      '简历评估': '#8b5cf6',
      '面试': '#f59e0b',
      '笔试': '#10b981',
      'Offer沟通': '#ec4899',
      '待入职': '#06b6d4',
      '已入职': '#22c55e',
      '已终止': '#6b7280',
    };
    return colorMap[stageName] || '#6b7280';
  };

  // Get total candidate count
  const totalCandidates = stageStats.reduce((sum, stat) => sum + stat.count, 0);

  return (
    <PageLayout title="候选人" description="管理招聘流程中的候选人">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - Job Filter */}
        <div className={`lg:w-64 flex-shrink-0 ${showJobFilter ? 'block' : 'hidden lg:block'}`}>
          <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#e2e8f0]">职位筛选</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJobFilter(false)}
                className="lg:hidden text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {jobsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#3b82f6]" />
              </div>
            ) : (
              <div className="space-y-1">
                {/* All candidates option */}
                <button
                  onClick={() => handleJobSelect(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedJobId === null
                      ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                      : 'text-[#94a3b8] hover:bg-[#2a2d35] hover:text-[#e2e8f0]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>全部职位</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2d35]">
                    {totalCandidates}
                  </span>
                </button>

                {/* Job list */}
                {jobsWithCandidates.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleJobSelect(job.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedJobId === job.id
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                        : 'text-[#94a3b8] hover:bg-[#2a2d35] hover:text-[#e2e8f0]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      <span className="truncate">{job.title}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2d35]">
                      {job.candidateCount}
                    </span>
                  </button>
                ))}

                {jobsWithCandidates.length === 0 && !jobsLoading && (
                  <p className="text-xs text-[#64748b] text-center py-4">
                    暂无在招职位
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Stage Stats Bar */}
          <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#e2e8f0]">阶段统计</h3>
              {!showJobFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowJobFilter(true)}
                  className="lg:hidden text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  筛选
                </Button>
              )}
            </div>

            {statsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#3b82f6]" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* All stages button */}
                <button
                  onClick={() => handleStageSelect(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedStageId === null
                      ? 'bg-[#3b82f6] text-white'
                      : 'bg-[#2a2d35] text-[#94a3b8] hover:bg-[#3a3d45] hover:text-[#e2e8f0]'
                  }`}
                >
                  全部 ({totalCandidates})
                </button>

                {/* Stage buttons */}
                {stageStats.map((stat) => (
                  <button
                    key={stat.stageName}
                    onClick={() => handleStageSelect(stat.stageName)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedStageId === stat.stageName
                        ? 'text-white'
                        : 'bg-[#2a2d35] text-[#94a3b8] hover:bg-[#3a3d45] hover:text-[#e2e8f0]'
                    }`}
                    style={{
                      backgroundColor:
                        selectedStageId === stat.stageName
                          ? getStageColor(stat.stageName)
                          : undefined,
                    }}
                  >
                    {stat.stageName} ({stat.count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <Input
                placeholder="搜索姓名、手机号、邮箱、公司..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0] placeholder:text-[#64748b]"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              搜索
            </Button>
          </div>

          {/* Batch Actions Bar */}
          {selectedCandidates.size > 0 && (
            <div className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20">
              <div className="flex items-center gap-2 text-sm text-[#3b82f6]">
                <CheckSquare className="w-4 h-4" />
                <span>已选择 <strong>{selectedCandidates.size}</strong> 位候选人</span>
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                {/* Batch move to stage dropdown */}
                {selectedJobId && stages.length > 0 && (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={batchActionLoading}
                      className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
                      onClick={() => setShowBatchActions(!showBatchActions)}
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      批量推进
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                    
                    {showBatchActions && (
                      <div className="absolute top-full left-0 mt-1 w-48 rounded-lg border border-[#2a2d35] bg-[#1a1d24] shadow-lg z-10">
                        <div className="p-2">
                          <p className="text-xs text-[#94a3b8] px-2 py-1">选择目标阶段</p>
                          {stages.map((stage) => (
                            <button
                              key={stage.id}
                              onClick={() => {
                                handleBatchMoveToStage(stage.id);
                                setShowBatchActions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-[#e2e8f0] hover:bg-[#2a2d35] rounded"
                            >
                              {stage.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Batch reject */}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={batchActionLoading}
                  onClick={handleBatchReject}
                  className="text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                >
                  <X className="w-4 h-4 mr-1" />
                  批量淘汰
                </Button>
                
                {/* Clear selection */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
                >
                  取消选择
                </Button>
              </div>
            </div>
          )}

          {/* Candidates List */}
          {candidatesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
              <span className="ml-3 text-sm text-[#94a3b8]">加载中...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2d35] bg-[#1a1d24] py-16">
              <Users className="w-12 h-12 mb-4 text-[#3b82f6]" />
              <h2 className="text-lg font-medium text-[#e2e8f0] mb-2">暂无候选人</h2>
              <p className="text-sm text-[#94a3b8] mb-6">
                {selectedJobId
                  ? '该职位暂无候选人，请从人才库推荐'
                  : '请先从人才库推荐候选人到在招职位'}
              </p>
            </div>
          ) : (
            <>
              {/* Select All and Candidate Count */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-[#94a3b8] hover:text-[#3b82f6] transition-colors"
                  >
                    {selectedCandidates.size === candidates.length && candidates.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-[#3b82f6]" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-sm text-[#94a3b8]">
                    全选 ({candidates.length} 位候选人)
                  </span>
                </div>
                <span className="text-xs text-[#64748b]">
                  共 {total} 位候选人
                </span>
              </div>

              {/* Candidate Cards */}
              <div className="space-y-3">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.pipelineId}
                    className={`rounded-xl border bg-[#1a1d24] p-4 transition-colors cursor-pointer ${
                      selectedCandidates.has(candidate.pipelineId)
                        ? 'border-[#3b82f6] bg-[#3b82f6]/5'
                        : 'border-[#2a2d35] hover:border-[#3b82f6]/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <div className="flex items-center pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCandidateSelect(candidate.pipelineId, !selectedCandidates.has(candidate.pipelineId));
                          }}
                          className="text-[#94a3b8] hover:text-[#3b82f6] transition-colors"
                        >
                          {selectedCandidates.has(candidate.pipelineId) ? (
                            <CheckSquare className="w-5 h-5 text-[#3b82f6]" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-[#2a2d35] flex items-center justify-center flex-shrink-0">
                        {candidate.avatarUrl ? (
                          <img
                            src={candidate.avatarUrl}
                            alt={candidate.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-[#e2e8f0]">
                            {candidate.name.charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Candidate Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-[#e2e8f0]">
                            {candidate.name}
                          </h3>
                          {candidate.age && (
                            <span className="text-xs text-[#94a3b8]">
                              {candidate.age}岁
                            </span>
                          )}
                          {candidate.yearsExp && (
                            <span className="text-xs text-[#94a3b8]">
                              {candidate.yearsExp}年经验
                            </span>
                          )}
                        </div>

                        {/* Work Experience */}
                        {candidate.currentCompany && (
                          <div className="flex items-center gap-1 text-xs text-[#94a3b8] mb-2">
                            <Briefcase className="w-3 h-3" />
                            <span>
                              {candidate.currentCompany}
                              {candidate.currentPosition && ` · ${candidate.currentPosition}`}
                            </span>
                          </div>
                        )}

                        {/* Job and Stage Info */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#2a2d35] text-[#94a3b8]">
                            <Briefcase className="w-3 h-3" />
                            {candidate.jobTitle}
                          </span>

                          {candidate.currentStageName && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white"
                              style={{
                                backgroundColor: getStageColor(candidate.currentStageName),
                              }}
                            >
                              {candidate.currentStageName}
                            </span>
                          )}

                          {candidate.appliedAt && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#2a2d35] text-[#94a3b8]">
                              <Calendar className="w-3 h-3" />
                              {formatDate(candidate.appliedAt)}
                            </span>
                          )}
                        </div>

                        {/* Interview Conclusion */}
                        {candidate.interviewConclusion && (
                          <div className="mt-2 flex items-start gap-1 text-xs text-[#94a3b8]">
                            <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">
                              面试结论: {candidate.interviewConclusion}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-xs text-[#94a3b8]">
                    共 {total} 位候选人，第 {page}/{totalPages} 页
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default Candidates;