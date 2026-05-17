import { create } from 'zustand';
import type { Candidate, PaginatedCandidates, CandidateListParams } from '@/types';
import { api } from '@/lib/api';

interface CandidateFilters {
  tags: string[];
  education: string | null;
  minExp: number | null;
  maxExp: number | null;
  source: string | null;
}

type ViewMode = 'all' | 'talent-pool';
type SortField = 'name' | 'created_at' | 'updated_at' | 'years_exp' | 'education';
type SortOrder = 'asc' | 'desc';

interface CandidateState {
  // Data
  candidates: Candidate[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;

  // UI State
  loading: boolean;
  error: string | null;
  searchKeyword: string;
  filters: CandidateFilters;
  viewMode: ViewMode;
  sortBy: SortField;
  sortOrder: SortOrder;

  // Search index maps for QuickRecord
  nameMap: Map<string, string>; // name -> candidateId
  phoneLast4Map: Map<string, string[]>; // last4 digits -> candidateId[]

  // Actions
  fetchCandidates: () => Promise<void>;
  createCandidate: (input: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'inTalentPool'>, autoPool?: boolean) => Promise<void>;
  updateCandidate: (id: string, input: Partial<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'inTalentPool'>>) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  setSearchKeyword: (kw: string) => void;
  setFilters: (filters: Partial<CandidateFilters>) => void;
  resetFilters: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (field: SortField) => void;
  toggleSortOrder: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
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
  // Data
  candidates: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,

  // UI State
  loading: false,
  error: null,
  searchKeyword: '',
  filters: { ...defaultFilters },
  viewMode: 'all',
  sortBy: 'created_at',
  sortOrder: 'desc',

  // Search index
  nameMap: new Map(),
  phoneLast4Map: new Map(),

  fetchCandidates: async () => {
    set({ loading: true, error: null });
    try {
      const { searchKeyword, filters, viewMode, page, pageSize, sortBy, sortOrder } = get();

      const params: CandidateListParams = {
        keyword: searchKeyword || undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        education: filters.education || undefined,
        minExp: filters.minExp ?? undefined,
        maxExp: filters.maxExp ?? undefined,
        source: filters.source || undefined,
        inTalentPool: viewMode === 'talent-pool' ? true : undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      };

      const result = await api.candidates.list(params);
      set({
        candidates: result.items,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        loading: false,
      });

      // Sync search index after fetching
      const nameMap = new Map<string, string>();
      const phoneLast4Map = new Map<string, string[]>();
      for (const c of result.items) {
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

  createCandidate: async (input, autoPool?: boolean) => {
    set({ loading: true, error: null });
    try {
      const candidate = await api.candidates.create(input, autoPool);
      // Refresh list to get updated pagination
      await get().fetchCandidates();
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
      // Refresh list to get updated pagination
      await get().fetchCandidates();
      // Remove from search index
      get().removeFromSearchIndex(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  setSearchKeyword: (kw) => {
    set({ searchKeyword: kw, page: 1 }); // Reset to first page on search
  },

  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters }, page: 1 }); // Reset to first page on filter change
  },

  resetFilters: () => {
    set({ filters: { ...defaultFilters }, page: 1 });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode, page: 1 }); // Reset to first page on view change
    get().fetchCandidates();
  },

  setSortBy: (field) => {
    set({ sortBy: field, page: 1 });
    get().fetchCandidates();
  },

  toggleSortOrder: () => {
    set({ sortOrder: get().sortOrder === 'asc' ? 'desc' : 'asc', page: 1 });
    get().fetchCandidates();
  },

  setPage: (page) => {
    set({ page });
    get().fetchCandidates();
  },

  setPageSize: (size) => {
    set({ pageSize: size, page: 1 });
    get().fetchCandidates();
  },

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
