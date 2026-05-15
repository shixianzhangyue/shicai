import { useCandidateStore } from '@/stores/candidateStore';

/**
 * Convenience hook that exposes the candidate store.
 * Prefer using `useCandidateStore` directly for write operations.
 */
export function useCandidates() {
  const candidates = useCandidateStore((state) => state.candidates);
  const loading = useCandidateStore((state) => state.loading);
  const error = useCandidateStore((state) => state.error);
  const searchKeyword = useCandidateStore((state) => state.searchKeyword);
  const filters = useCandidateStore((state) => state.filters);
  const fetchCandidates = useCandidateStore((state) => state.fetchCandidates);
  const createCandidate = useCandidateStore((state) => state.createCandidate);
  const updateCandidate = useCandidateStore((state) => state.updateCandidate);
  const deleteCandidate = useCandidateStore((state) => state.deleteCandidate);
  const setSearchKeyword = useCandidateStore((state) => state.setSearchKeyword);
  const setFilters = useCandidateStore((state) => state.setFilters);
  const resetFilters = useCandidateStore((state) => state.resetFilters);

  return {
    candidates,
    isLoading: loading,
    error,
    searchKeyword,
    filters,
    fetchCandidates,
    createCandidate,
    updateCandidate,
    deleteCandidate,
    setSearchKeyword,
    setFilters,
    resetFilters,
  };
}
