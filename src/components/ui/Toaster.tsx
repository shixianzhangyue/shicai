import { useToast } from '@/hooks/useToast';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400' },
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = iconMap[t.type];
        const colors = colorMap[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border} backdrop-blur-sm animate-in slide-in-from-right-5 fade-in-0`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${colors.icon}`} />
            <p className="flex-1 text-sm text-[#e2e8f0]">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 rounded hover:bg-white/10 text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
