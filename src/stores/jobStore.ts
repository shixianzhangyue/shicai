import { create } from 'zustand';
import type { Job, JobStatus } from '@/types';
import { api } from '@/lib/api';

interface JobState {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  searchKeyword: string;
  statusFilter: JobStatus | null;
  fetchJobs: () => Promise<void>;
  createJob: (input: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Job>;
  updateJob: (id: string, input: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  duplicateJob: (id: string) => Promise<void>;
  updateJobStatus: (id: string, status: JobStatus) => Promise<void>;
  setSearchKeyword: (kw: string) => void;
  setStatusFilter: (filter: JobStatus | null) => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,
  searchKeyword: '',
  statusFilter: null,

  fetchJobs: async () => {
    set({ loading: true, error: null });
    try {
      const jobs = await api.jobs.list();
      set({ jobs, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  createJob: async (input) => {
    set({ loading: true, error: null });
    try {
      const job = await api.jobs.create(input);
      set({ jobs: [job, ...get().jobs], loading: false });
      return job;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  updateJob: async (id, input) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.jobs.update(id, input);
      set({
        jobs: get().jobs.map((j) => (j.id === id ? updated : j)),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  deleteJob: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.jobs.delete(id);
      set({
        jobs: get().jobs.filter((j) => j.id !== id),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  duplicateJob: async (id) => {
    set({ loading: true, error: null });
    try {
      const job = await api.jobs.duplicate(id);
      set({ jobs: [job, ...get().jobs], loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  updateJobStatus: async (id, status) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.jobs.update(id, { status });
      set({
        jobs: get().jobs.map((j) => (j.id === id ? updated : j)),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  setSearchKeyword: (kw) => set({ searchKeyword: kw }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
}));
