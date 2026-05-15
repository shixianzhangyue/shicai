import { create } from 'zustand';
import type { PipelineStage } from '@/types';
import { api } from '@/lib/api';

interface PipelineState {
  stages: PipelineStage[];
  loading: boolean;
  error: string | null;
  fetchStages: (jobId: string) => Promise<void>;
  createStage: (jobId: string, name: string, sortOrder: number) => Promise<void>;
  updateStage: (id: string, data: { name?: string; sortOrder?: number }) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  reorderStages: (jobId: string, stageIds: string[]) => Promise<void>;
  initDefaultStages: (jobId: string) => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  stages: [],
  loading: false,
  error: null,

  fetchStages: async (jobId: string) => {
    set({ loading: true, error: null });
    try {
      const stages = await api.pipeline.getStagesByJob(jobId);
      set({ stages, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  createStage: async (jobId: string, name: string, sortOrder: number) => {
    set({ loading: true, error: null });
    try {
      const stage = await api.pipeline.createStage(jobId, name, sortOrder);
      set({ stages: [...get().stages, stage], loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  updateStage: async (id: string, data: { name?: string; sortOrder?: number }) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.pipeline.updateStage(id, data);
      set({
        stages: get().stages.map((s) => (s.id === id ? updated : s)),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  deleteStage: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.pipeline.deleteStage(id);
      set({
        stages: get().stages.filter((s) => s.id !== id),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  reorderStages: async (jobId: string, stageIds: string[]) => {
    set({ loading: true, error: null });
    try {
      await api.pipeline.reorderStages(jobId, stageIds);
      // Re-fetch to get updated sort orders
      const stages = await api.pipeline.getStagesByJob(jobId);
      set({ stages, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  initDefaultStages: async (jobId: string) => {
    set({ loading: true, error: null });
    try {
      const stages = await api.pipeline.initDefaultStages(jobId);
      set({ stages, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },
}));
