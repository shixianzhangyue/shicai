import { useJobStore } from '@/stores/jobStore';

/**
 * Convenience hook that exposes the job store.
 * Prefer using `useJobStore` directly for write operations.
 */
export function useJobs() {
  const jobs = useJobStore((state) => state.jobs);
  const loading = useJobStore((state) => state.loading);
  const error = useJobStore((state) => state.error);
  const searchKeyword = useJobStore((state) => state.searchKeyword);
  const statusFilter = useJobStore((state) => state.statusFilter);
  const fetchJobs = useJobStore((state) => state.fetchJobs);
  const setSearchKeyword = useJobStore((state) => state.setSearchKeyword);
  const setStatusFilter = useJobStore((state) => state.setStatusFilter);

  return {
    jobs,
    isLoading: loading,
    error,
    searchKeyword,
    statusFilter,
    fetchJobs,
    setSearchKeyword,
    setStatusFilter,
  };
}
