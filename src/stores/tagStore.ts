import { create } from 'zustand';
import type { Tag } from '@/types';
import { api } from '@/lib/api';

interface TagState {
  tags: Tag[];
  loading: boolean;
  error: string | null;
  fetchTags: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<void>;
  updateTag: (id: string, data: Partial<Pick<Tag, 'name' | 'color'>>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,
  error: null,

  fetchTags: async () => {
    set({ loading: true, error: null });
    try {
      const tags = await api.tags.list();
      set({ tags, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  createTag: async (name, color) => {
    set({ loading: true, error: null });
    try {
      const tag = await api.tags.create(name, color);
      set({ tags: [tag, ...get().tags], loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  updateTag: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.tags.update(id, data);
      set({
        tags: get().tags.map((t) => (t.id === id ? updated : t)),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  deleteTag: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.tags.delete(id);
      set({
        tags: get().tags.filter((t) => t.id !== id),
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },
}));
