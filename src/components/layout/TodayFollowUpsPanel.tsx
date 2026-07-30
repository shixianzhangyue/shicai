import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { FollowUpWithCandidate } from '@/types';
import { X, Bell, User, Phone, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notify } from '@/lib/notify';

interface TodayFollowUpsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function TodayFollowUpsPanel({ open, onClose }: TodayFollowUpsPanelProps) {
  const [followUps, setFollowUps] = useState<FollowUpWithCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchFollowUps();
    }
  }, [open]);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const data = await api.followUps.getToday();
      setFollowUps(data);
    } catch (err) {
      notify.error('Failed to fetch today follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (candidateId: string) => {
    onClose();
    navigate(`/candidates?id=${candidateId}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-[360px] max-w-full h-full bg-[#1a1d24] border-l border-[#2a2d35] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d35]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-sm font-medium text-[#e2e8f0]">今日待跟进</span>
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
              {followUps.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#2a2d35] text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#94a3b8]">加载中...</div>
          ) : followUps.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-10 h-10 mx-auto mb-3 text-[#2a2d35]" />
              <p className="text-sm text-[#94a3b8]">今日暂无待跟进</p>
              <p className="text-xs text-[#64748b] mt-1">有设置了下次跟进日期的记录会显示在这里</p>
            </div>
          ) : (
            followUps.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.candidateId)}
                className="w-full text-left p-3 rounded-lg border border-[#2a2d35] bg-[#0f1117] hover:border-[#3b82f6]/30 hover:bg-[#0f1117]/80 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#e2e8f0]">
                        {item.candidateName}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#64748b] group-hover:text-[#3b82f6] transition-colors" />
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-1 line-clamp-2">
                      {item.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      {item.nextFollowDate && (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <Calendar className="w-3 h-3" />
                          {item.nextFollowDate}
                        </span>
                      )}
                      {item.relatedJobId && (
                        <span className="flex items-center gap-1 text-xs text-[#3b82f6]">
                          <Phone className="w-3 h-3" />
                          关联职位
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
