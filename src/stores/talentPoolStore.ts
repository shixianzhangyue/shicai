import { create } from 'zustand';
import type { Candidate } from '@/types';

interface TalentPoolState {
  pool: Candidate[];
  isLoading: boolean;
  setPool: (pool: Candidate[]) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useTalentPoolStore = create<TalentPoolState>((set) => ({
  pool: [],
  isLoading: false,
  setPool: (pool) => set({ pool }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));
