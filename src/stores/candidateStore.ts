import { create } from 'zustand';
import type { Candidate } from '@/types';
import { api } from '@/lib/api';

interface CandidateFilters {
  tags: string[];
  education: string | null;
  minExp: number | null;
  maxExp: number | null;
  source: string | null;
}

interface CandidateState {
  candidates: Candidate[];
  loading: boolean;
  error: string | null;
  searchKeyword: string;
  filters: CandidateFilters;
  // Search index maps for QuickRecord
  nameMap: Map<string, string>; // name -> candidateId
  phoneLast4Map: Map<string, string[]>; // last4 digits -> candidateId[]
  fetchCandidates: () => Promise<void>;
  createCandidate: (input: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => Promise<void>;
  updateCandidate: (id: string, input: Partial<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  setSearchKeyword: (kw: string) => void;
  setFilters: (filters: Partial<CandidateFilters>) => void;
  resetFilters: () => void;
  loadSearchIndex: () => Promise<void>;
  addToSearchIndex: (candidate: Candidate) => void;
  removeFromSearchIndex: (candidateId: string) => void;
}

const defaultFilters: CandidateFilters = {
  tags: [],
  education: null,
  minExp: null,
  maxExp: null,
  source: null,
};

export const useCandidateStore = create<CandidateState>((set, get) => ({
  candidates: [],
  loading: false,
  error: null,
  searchKeyword: '',
  filters: { ...defaultFilters },
  nameMap: new Map(),
  phoneLast4Map: new Map(),

  fetchCandidates: async () => {
    set({ loading: true, error: null });
    try {
      const { searchKeyword, filters } = get();
      const candidates = await api.candidates.list({
        keyword: searchKeyword || undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        education: filters.education || undefined,
        minExp: filters.minExp ?? undefined,
        maxExp: filters.maxExp ?? undefined,
        source: filters.source || undefined,
      });
      set({ candidates, loading: false });
      // Sync search index after fetching
      const nameMap = new Map<string, string>();
      const phoneLast4Map = new Map<string, string[]>();
      for (const c of candidates) {
        if (c.name) nameMap.set(c.name, c.id);
        if (c.phone && c.phone.length >= 4) {
          const last4 = c.phone.slice(-4);
          const existing = phoneLast4Map.get(last4) || [];
          phoneLast4Map.set(last4, [...existing, c.id]);
        }
      }
      set({ nameMap, phoneLast4Map });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  createCandidate: async (input) => {
    set({ loading: true, error: null });
    try {
      const candidate = await api.candidates.create(input);
      set({ candidates: [candidate, ...get().candidates], loading: false });
      // Add to search index
      get().addToSearchIndex(candidate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  updateCandidate: async (id, input) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.candidates.update(id, input);
      set({
        candidates: get().candidates.map((c) => (c.id === id ? updated : c)),
        loading: false,
      });
      // Update search index
      get().removeFromSearchIndex(id);
      get().addToSearchIndex(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  deleteCandidate: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.candidates.delete(id);
      set({
        candidates: get().candidates.filter((c) => c.id !== id),
        loading: false,
      });
      // Remove from search index
      get().removeFromSearchIndex(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  setSearchKeyword: (kw) => set({ searchKeyword: kw }),
  setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  loadSearchIndex: async () => {
    try {
      const index = await api.talentPool.getSearchIndex();
      const nameMap = new Map<string, string>();
      const phoneLast4Map = new Map<string, string[]>();
      for (const item of index) {
        if (item.name) nameMap.set(item.name, item.id);
        if (item.phoneLast4) {
          const existing = phoneLast4Map.get(item.phoneLast4) || [];
          phoneLast4Map.set(item.phoneLast4, [...existing, item.id]);
        }
      }
      set({ nameMap, phoneLast4Map });
    } catch (err) {
      console.error('Failed to load search index:', err);
    }
  },

  addToSearchIndex: (candidate) => {
    const { nameMap, phoneLast4Map } = get();
    if (candidate.name) nameMap.set(candidate.name, candidate.id);
    if (candidate.phone && candidate.phone.length >= 4) {
      const last4 = candidate.phone.slice(-4);
      const existing = phoneLast4Map.get(last4) || [];
      if (!existing.includes(candidate.id)) {
        phoneLast4Map.set(last4, [...existing, candidate.id]);
      }
    }
    set({ nameMap: new Map(nameMap), phoneLast4Map: new Map(phoneLast4Map) });
  },

  removeFromSearchIndex: (candidateId) => {
    const { nameMap, phoneLast4Map } = get();
    // Remove from nameMap
    for (const [name, id] of nameMap.entries()) {
      if (id === candidateId) {
        nameMap.delete(name);
        break;
      }
    }
    // Remove from phoneLast4Map
    for (const [last4, ids] of phoneLast4Map.entries()) {
      const filtered = ids.filter((id) => id !== candidateId);
      if (filtered.length === 0) {
        phoneLast4Map.delete(last4);
      } else {
        phoneLast4Map.set(last4, filtered);
      }
    }
    set({ nameMap: new Map(nameMap), phoneLast4Map: new Map(phoneLast4Map) });
  },
}));
