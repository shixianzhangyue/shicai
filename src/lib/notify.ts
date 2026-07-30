import { toast } from '@/hooks/useToast';

/**
 * Unified notification API.
 * Use instead of console.error / alert / confirm.
 */
export const notify = {
  success: (msg: string) => toast('success', msg),
  error: (msg: string) => toast('error', msg, 5000),
  warning: (msg: string) => toast('warning', msg, 4000),
  info: (msg: string) => toast('info', msg),
};
