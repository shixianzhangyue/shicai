import { useState, useCallback, useRef } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

let globalToasts: Toast[] = [];
let globalSetToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  globalSetToasts = setToasts;
  globalToasts = toasts;

  const toast = useCallback((type: Toast['type'], message: string, duration = 3000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newToast: Toast = { id, type, message, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismiss };
}

// Standalone toast function for use outside components
export function toast(type: Toast['type'], message: string, duration = 3000) {
  if (!globalSetToasts) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newToast: Toast = { id, type, message, duration };
  globalSetToasts((prev) => [...prev, newToast]);

  if (duration > 0) {
    setTimeout(() => {
      globalSetToasts?.((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }
}
