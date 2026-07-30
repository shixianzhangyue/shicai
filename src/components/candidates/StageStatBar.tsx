import type { StageStat } from '@/types';

interface StageStatBarProps {
  stats: StageStat[];
  total: number;
  selectedStage: string | null;
  onSelect: (stage: string | null) => void;
}

const STAGE_COLORS: Record<string, string> = {
  '简历筛选': '#3b82f6',
  '面试': '#f59e0b',
  'Offer沟通': '#ec4899',
  '已入职': '#22c55e',
  '已终止': '#6b7280',
};

export function StageStatBar({ stats, total, selectedStage, onSelect }: StageStatBarProps) {
  return (
    <div className="flex items-center gap-0 border-b border-[#2a2d35] bg-[#0f1117]">
      {/* All */}
      <button
        onClick={() => onSelect(null)}
        className={`flex-1 flex flex-col items-center py-3 transition-colors border-b-2 ${
          selectedStage === null
            ? 'border-[#3b82f6] text-[#3b82f6]'
            : 'border-transparent text-[#94a3b8] hover:text-[#e2e8f0]'
        }`}
      >
        <span className="text-xl font-bold">{total}</span>
        <span className="text-[10px] mt-0.5">全部</span>
      </button>

      {/* Stages */}
      {stats.map((stat) => {
        const color = STAGE_COLORS[stat.stageName] || '#6b7280';
        const isActive = selectedStage === stat.stageName;
        return (
          <button
            key={stat.stageName}
            onClick={() => onSelect(stat.stageName)}
            className={`flex-1 flex flex-col items-center py-3 transition-colors border-b-2 ${
              isActive
                ? 'border-current text-current'
                : 'border-transparent text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
            style={isActive ? { color } : undefined}
          >
            <span className="text-xl font-bold">{stat.count}</span>
            <span className="text-[10px] mt-0.5">{stat.stageName}</span>
          </button>
        );
      })}
    </div>
  );
}
