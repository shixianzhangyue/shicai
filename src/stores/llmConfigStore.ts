import { create } from 'zustand';
import type { LlmConfig } from '@/types';
import { api } from '@/lib/api';

interface LlmConfigStore {
  configs: LlmConfig[];
  loading: boolean;
  error: string | null;
  fetchConfigs: () => Promise<void>;
  createConfig: (input: Omit<LlmConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateConfig: (id: number, input: Partial<Omit<LlmConfig, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteConfig: (id: number) => Promise<void>;
  setDefault: (id: number) => Promise<void>;
}

export const useLlmConfigStore = create<LlmConfigStore>((set, get) => ({
  configs: [],
  loading: false,
  error: null,

  fetchConfigs: async () => {
    set({ loading: true, error: null });
    try {
      const configs = await api.llmConfigs.list();
      set({ configs, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  createConfig: async (input) => {
    set({ loading: true, error: null });
    try {
      const config = await api.llmConfigs.create(input);
      set({ configs: [config, ...get().configs], loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  updateConfig: async (id, input) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.llmConfigs.update(id, input);
      set({
        configs: get().configs.map((c) => (c.id === id ? updated : c)),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  deleteConfig: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.llmConfigs.delete(id);
      set({
        configs: get().configs.filter((c) => c.id !== id),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  setDefault: async (id) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.llmConfigs.update(id, { isDefault: true });
      set({
        configs: get().configs.map((c) =>
          c.id === id ? updated : { ...c, isDefault: false }
        ),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },
}));
