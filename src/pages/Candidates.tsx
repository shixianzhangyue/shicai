import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CandidateDetail } from '@/components/candidates/CandidateDetail';
import { FollowUpDialog } from '@/components/candidates/FollowUpDialog';
import { JobSidebar } from '@/components/candidates/JobSidebar';
import { StageStatBar } from '@/components/candidates/StageStatBar';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import {
  Search, Loader2, ChevronDown, CheckSquare, Square,
  ArrowRight, X, ArrowUpDown,
} from 'lucide-react';
import { useCandidatePage } from '@/hooks/useCandidatePage';

function Candidates() {
  const {
    // State
    stageStats,
    statsLoading,
    stages,
    jobsWithCandidates,
    selectedJobId,
    candidates,
    candidatesLoading,
    total,
    page,
    totalPages,
    searchKeyword,
    selectedStageName,
    selectedCandidates,
    showBatchActions,
    batchActionLoading,
    detailCandidate,
    detailOpen,
    followUpTarget,
    followUpDialogOpen,
    followUpPipelineJobs,
    sortOrder,
    // Derived
    totalCandidates,
    // Setters
    setSearchKeyword,
    setPage,
    setShowBatchActions,
    setSortOrder,
    setDetailOpen,
    setDetailCandidate,
    setFollowUpDialogOpen,
    setFollowUpTarget,
    // Handlers
    handleJobSelect,
    handleStageSelect,
    handleSearch,
    handleCandidateSelect,
    handleSelectAll,
    handleBatchMoveToStage,
    handleBatchReject,
    handleOpenDetail,
    handleOpenFollowUp,
    handleReject,
    fetchCandidates,
  } = useCandidatePage();

  return (
    <PageLayout title="候选人" description="管理招聘流程中的候选人">
      <div className="flex h-[calc(100vh-120px)]">
        {/* Left Sidebar - Job List */}
        <JobSidebar
          jobs={jobsWithCandidates}
          selectedJobId={selectedJobId}
          onSelect={handleJobSelect}
          total={totalCandidates}
        />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Stage Stats Bar */}
          {statsLoading ? (
            <div className="flex items-center justify-center py-4 border-b border-[#2a2d35]">
              <Loader2 className="w-5 h-5 animate-spin text-[#3b82f6]" />
            </div>
          ) : (
            <StageStatBar
              stats={stageStats}
              total={totalCandidates}
              selectedStage={selectedStageName}
              onSelect={handleStageSelect}
            />
          )}

          {/* Search + Sort + Batch Actions */}
          <div className="px-4 py-3 border-b border-[#2a2d35] space-y-3">
            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                <Input
                  placeholder="通过姓名、电话、邮箱、公司、任职职位搜索"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0] placeholder:text-[#64748b]"
                />
              </div>
              <Button onClick={handleSearch} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white shrink-0">搜索</Button>
            </div>

            {/* Select all + Sort + Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={handleSelectAll} className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#e2e8f0]">
                  {selectedCandidates.size === candidates.length && candidates.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#3b82f6]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  全选
                </button>
                <span className="text-sm text-[#94a3b8]">{total} 个结果</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort */}
                <button
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1.5 text-xs text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  排序：申请时间{sortOrder === 'desc' ? '降序' : '升序'}
                </button>
              </div>
            </div>

            {/* Batch Actions */}
            {selectedCandidates.size > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20">
                <span className="text-sm text-[#3b82f6]">已选 {selectedCandidates.size} 人</span>
                <div className="flex items-center gap-2 ml-auto">
                  {selectedJobId && stages.length > 0 && (
                    <div className="relative">
                      <Button variant="ghost" size="sm" disabled={batchActionLoading} onClick={() => setShowBatchActions(!showBatchActions)} className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]">
                        <ArrowRight className="w-4 h-4 mr-1" />批量推进<ChevronDown className="w-4 h-4 ml-1" />
                      </Button>
                      {showBatchActions && (
                        <div className="absolute top-full left-0 mt-1 w-48 rounded-lg border border-[#2a2d35] bg-[#1a1d24] shadow-lg z-10">
                          <div className="p-2">
                            <p className="text-xs text-[#94a3b8] px-2 py-1">选择目标阶段</p>
                            {stages.map((stage) => (
                              <button key={stage.id} onClick={() => { handleBatchMoveToStage(stage.id); setShowBatchActions(false); }}
                                className="w-full text-left px-3 py-2 text-sm text-[#e2e8f0] hover:bg-[#2a2d35] rounded">{stage.name}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" disabled={batchActionLoading} onClick={handleBatchReject} className="text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10">
                    <X className="w-4 h-4 mr-1" />批量淘汰
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCandidates(new Set())} className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]">
                    取消
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Candidate Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {candidatesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
                <span className="ml-3 text-sm text-[#94a3b8]">加载中...</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-[#2a2d35] flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-[#64748b]" />
                </div>
                <h2 className="text-lg font-medium text-[#e2e8f0] mb-2">暂无候选人</h2>
                <p className="text-sm text-[#94a3b8]">{selectedJobId ? '该职位暂无候选人' : '请从人才库推荐候选人到在招职位'}</p>
              </div>
            ) : (
              candidates.map((c) => (
                <CandidateCard
                  key={c.pipelineId}
                  candidate={c}
                  selected={selectedCandidates.has(c.pipelineId)}
                  onSelect={handleCandidateSelect}
                  onDetail={() => handleOpenDetail(c)}
                  onFollowUp={() => handleOpenFollowUp(c.candidateId, c.name)}
                  onReject={handleReject}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-[#2a2d35]">
              <Button
                variant="ghost" size="sm" disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                上一页
              </Button>
              <span className="text-sm text-[#94a3b8]">{page} / {totalPages}</span>
              <Button
                variant="ghost" size="sm" disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Detail */}
      <CandidateDetail
        candidate={detailCandidate}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailCandidate(null); }}
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

export default Candidates;
