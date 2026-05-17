import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Briefcase, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Candidate, Job } from '@/types';
import { useUIStore } from '@/stores/uiStore';

interface RecommendToJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: Candidate[];
  onSuccess?: () => void;
}

export function RecommendToJobDialog({
  open,
  onOpenChange,
  candidates,
  onSuccess,
}: RecommendToJobDialogProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const { showToast } = useUIStore();

  // Load jobs when dialog opens
  useEffect(() => {
    if (open) {
      loadJobs();
      setSelectedJobId('');
      setResults(null);
    }
  }, [open]);

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const jobList = await api.jobs.list();
      // Only show active jobs
      setJobs(jobList.filter((j) => j.status === 'active'));
    } catch (error) {
      showToast('加载职位列表失败', 'error');
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleRecommend = async () => {
    if (!selectedJobId) {
      showToast('请选择目标职位', 'error');
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failedCount = 0;

    // Process candidates sequentially to avoid race conditions
    for (const candidate of candidates) {
      try {
        await api.pipeline.addToJob(candidate.id, selectedJobId);
        successCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // If candidate is already in job, count as success
        if (msg.includes('already') || msg.includes('已存在')) {
          successCount++;
        } else {
          failedCount++;
          console.error(`Failed to recommend ${candidate.name}:`, error);
        }
      }
    }

    setResults({ success: successCount, failed: failedCount });
    setLoading(false);

    if (successCount > 0) {
      showToast(`成功推荐 ${successCount} 位候选人`, 'success');
      onSuccess?.();
    }
    if (failedCount > 0) {
      showToast(`${failedCount} 位候选人推荐失败`, 'error');
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#1a1d24] border-[#2a2d35]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#e2e8f0]">
            <UserPlus className="w-5 h-5 text-[#3b82f6]" />
            推荐到职位
          </DialogTitle>
          <DialogDescription className="text-[#94a3b8]">
            将选中的 {candidates.length} 位候选人推荐到目标职位
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <>
            {/* Candidate List Preview */}
            <div className="mb-4">
              <Label className="text-sm text-[#94a3b8] mb-2 block">已选候选人</Label>
              <div className="max-h-[120px] overflow-y-auto rounded-lg border border-[#2a2d35] bg-[#0f1117] p-2">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center gap-2 py-1.5 px-2 text-sm text-[#e2e8f0]"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#3b82f6]/20 flex items-center justify-center text-xs text-[#3b82f6]">
                      {candidate.name[0]}
                    </div>
                    <span>{candidate.name}</span>
                    {candidate.currentPosition && (
                      <span className="text-[#64748b] text-xs">
                        · {candidate.currentPosition}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Job Selection */}
            <div className="mb-6">
              <Label className="text-sm text-[#94a3b8] mb-2 block">目标职位</Label>
              {loadingJobs ? (
                <div className="flex items-center gap-2 py-3 text-[#94a3b8]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">加载职位中...</span>
                </div>
              ) : (
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-[#0f1117] border border-[#2a2d35] text-sm text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                >
                  <option value="">选择职位</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                      {job.department ? ` · ${job.department}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedJob && (
                <div className="mt-2 p-2 rounded-lg bg-[#0f1117] border border-[#2a2d35]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#94a3b8]">HC: {selectedJob.headcount}人</span>
                    {selectedJob.salaryMin && selectedJob.salaryMax && (
                      <span className="text-[#22c55e]">
                        {selectedJob.salaryMin / 1000}K-{selectedJob.salaryMax / 1000}K
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
              >
                取消
              </Button>
              <Button
                onClick={handleRecommend}
                disabled={!selectedJobId || loading}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    推荐中...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    确认推荐
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Results */
          <div className="py-6">
            <div className="flex flex-col items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-[#22c55e] mb-4" />
              <h3 className="text-lg font-medium text-[#e2e8f0] mb-2">推荐完成</h3>
              <div className="flex gap-4 text-sm">
                {results.success > 0 && (
                  <span className="text-[#22c55e]">成功: {results.success}</span>
                )}
                {results.failed > 0 && (
                  <span className="text-red-400">失败: {results.failed}</span>
                )}
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                完成
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
