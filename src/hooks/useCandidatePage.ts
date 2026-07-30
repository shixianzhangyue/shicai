import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { notify } from '@/lib/notify';
import type { StageStat, CandidateWithPipeline, JobWithCandidateCount, PaginatedCandidateWithPipeline, Candidate } from '@/types';
import { confirm } from '@/components/ui/ConfirmDialog';

export function useCandidatePage() {
  const [searchParams] = useSearchParams();

  // ---- State ----
  const [stageStats, setStageStats] = useState<StageStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [jobsWithCandidates, setJobsWithCandidates] = useState<JobWithCandidateCount[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(searchParams.get('jobId'));
  const [jobsLoading, setJobsLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateWithPipeline[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedStageName, setSelectedStageName] = useState<string | null>(searchParams.get('stage'));
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<{ id: string; name: string } | null>(null);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpPipelineJobs, setFollowUpPipelineJobs] = useState<{ jobId: string; jobTitle: string }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // ---- Data Fetching ----
  const fetchStageStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const stats = await api.pipeline.getStageStats(selectedJobId);
      setStageStats(stats);
    } catch (err) {
      notify.error('Failed to fetch stage stats');
    } finally {
      setStatsLoading(false);
    }
  }, [selectedJobId]);

  const fetchStages = useCallback(async () => {
    if (!selectedJobId) { setStages([]); return; }
    try {
      const stagesList = await api.pipeline.getStagesByJob(selectedJobId);
      setStages(stagesList);
    } catch (err) {
      notify.error('Failed to fetch stages');
    }
  }, [selectedJobId]);

  const fetchJobsWithCandidates = useCallback(async () => {
    setJobsLoading(true);
    try {
      const jobs = await api.pipeline.getJobsWithCandidates();
      setJobsWithCandidates(jobs);
    } catch (err) {
      notify.error('Failed to fetch jobs with candidates');
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const fetchCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    try {
      const result: PaginatedCandidateWithPipeline = await api.pipeline.listCandidatesByJob({
        jobId: selectedJobId, stageName: selectedStageName,
        keyword: searchKeyword || undefined, page, pageSize,
      });
      // Sort by appliedAt
      const sorted = [...result.items].sort((a, b) => {
        const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
        const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
      setCandidates(sorted);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      notify.error('Failed to fetch candidates');
    } finally {
      setCandidatesLoading(false);
    }
  }, [selectedJobId, selectedStageName, searchKeyword, page, pageSize, sortOrder]);

  // ---- Effects ----
  useEffect(() => { fetchJobsWithCandidates(); }, [fetchJobsWithCandidates]);
  useEffect(() => { fetchStageStats(); fetchCandidates(); fetchStages(); }, [selectedJobId, selectedStageName, searchKeyword, page, pageSize, sortOrder]);

  // ---- Handlers ----
  const handleJobSelect = (jobId: string | null) => {
    setSelectedJobId(jobId);
    setSelectedStageName(null);
    setPage(1);
  };

  const handleStageSelect = (stageName: string | null) => {
    setSelectedStageName(stageName);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    fetchCandidates();
  };

  const handleCandidateSelect = (pipelineId: string, checked: boolean) => {
    setSelectedCandidates((prev) => {
      const n = new Set(prev);
      checked ? n.add(pipelineId) : n.delete(pipelineId);
      return n;
    });
  };

  const handleSelectAll = () => {
    setSelectedCandidates(
      selectedCandidates.size === candidates.length
        ? new Set()
        : new Set(candidates.map((c) => c.pipelineId))
    );
  };

  const handleBatchMoveToStage = async (stageId: string) => {
    if (!selectedCandidates.size) return;
    setBatchActionLoading(true);
    try {
      await api.pipeline.batchMove(Array.from(selectedCandidates), stageId);
      setSelectedCandidates(new Set());
      await fetchCandidates();
      await fetchStageStats();
    } catch (err) {
      notify.error('Batch move failed');
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchReject = async () => {
    if (!selectedCandidates.size) return;
    setBatchActionLoading(true);
    try {
      await api.pipeline.batchReject(Array.from(selectedCandidates));
      setSelectedCandidates(new Set());
      await fetchCandidates();
      await fetchStageStats();
    } catch (err) {
      notify.error('Batch reject failed');
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleOpenDetail = async (c: CandidateWithPipeline) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const fullCandidate = await api.candidates.get(c.candidateId);
      setDetailCandidate(fullCandidate);
    } catch {
      // Fallback to partial data
      setDetailCandidate({ ...c, id: c.candidateId } as unknown as Candidate);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenFollowUp = async (candidateId: string, candidateName: string) => {
    setFollowUpTarget({ id: candidateId, name: candidateName });
    try {
      const pipelines = await api.pipeline.getPipelineByCandidate(candidateId);
      const jobs = pipelines
        .filter((p) => p.jobId && p.status === 'active')
        .map((p) => ({ jobId: p.jobId!, jobTitle: p.jobTitle || '未命名职位' }));
      setFollowUpPipelineJobs(jobs);
    } catch {
      setFollowUpPipelineJobs([]);
    }
    setFollowUpDialogOpen(true);
  };

  const handleReject = async (pipelineId: string) => {
    if (!await confirm('确定要终止该候选人的投递吗？')) return;
    try {
      await api.pipeline.rejectCandidate(pipelineId);
      await fetchCandidates();
      await fetchStageStats();
    } catch (err) {
      notify.error('Reject failed');
    }
  };

  // ---- Derived ----
  const totalCandidates = stageStats.reduce((s, st) => s + st.count, 0);

  // ---- Return ----
  return {
    // State
    stageStats,
    statsLoading,
    stages,
    jobsWithCandidates,
    selectedJobId,
    jobsLoading,
    candidates,
    candidatesLoading,
    total,
    page,
    pageSize,
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
    detailLoading,
    sortOrder,
    // Derived
    totalCandidates,
    // Setters (for inline JSX handlers)
    setSearchKeyword,
    setPage,
    setShowBatchActions,
    setSortOrder,
    setDetailOpen,
    setDetailCandidate,
    setFollowUpDialogOpen,
    setFollowUpTarget,
    setSelectedCandidates,
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
  };
}
