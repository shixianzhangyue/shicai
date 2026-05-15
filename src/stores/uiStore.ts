import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toast: { message: string; type: 'success' | 'error' | 'warning' } | null;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toast: null,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  showToast: (message, type) => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),
}));
