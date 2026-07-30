import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

let globalResolve: ((value: boolean) => void) | null = null;
let globalSetState: React.Dispatch<React.SetStateAction<ConfirmState>> | null = null;

/**
 * Show a confirmation dialog. Returns a Promise<boolean>.
 * Use instead of window.confirm().
 */
export function confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!globalSetState) {
      // Fallback to native confirm if component not mounted
      resolve(window.confirm(message));
      return;
    }
    globalResolve = resolve;
    globalSetState({
      open: true,
      title: options?.title || '确认操作',
      description: message,
      confirmText: options?.confirmText || '确认',
      cancelText: options?.cancelText || '取消',
      variant: options?.variant || 'default',
      resolve,
    });
  });
}

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    confirmText: '确认',
    cancelText: '取消',
    variant: 'default',
    resolve: null,
  });

  globalSetState = setState;

  const handleClose = useCallback((confirmed: boolean) => {
    state.resolve?.(confirmed);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const borderColor = state.variant === 'danger'
    ? 'border-red-500/30'
    : state.variant === 'warning'
    ? 'border-amber-500/30'
    : 'border-[#2a2d35]';

  return (
    <Dialog open={state.open} onOpenChange={() => handleClose(false)}>
      <DialogContent className={`max-w-sm ${borderColor}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {state.variant !== 'default' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {state.title}
          </DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} className="text-[#94a3b8]">
            {state.cancelText}
          </Button>
          <Button
            onClick={() => handleClose(true)}
            className={
              state.variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : state.variant === 'warning'
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white'
            }
          >
            {state.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
