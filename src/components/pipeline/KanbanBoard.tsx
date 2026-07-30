import { useState, useCallback } from 'react';
import type { PipelineStage, PipelineEntry } from '@/types';
import { usePipelineStore } from '@/stores/pipelineStore';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  User,
  ArrowRight,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';

interface KanbanBoardProps {
  jobId: string;
  stages: PipelineStage[];
  entries: PipelineEntry[];
  onRefresh: () => void;
}

interface DragState {
  pipelineId: string | null;
  sourceStageId: string | null;
}

function KanbanBoard({ jobId, stages, entries, onRefresh }: KanbanBoardProps) {
  const { rejectCandidate, poolCandidate } = usePipelineStore();
  const [dragState, setDragState] = useState<DragState>({
    pipelineId: null,
    sourceStageId: null,
  });
  const [optimisticEntries, setOptimisticEntries] = useState<PipelineEntry[] | null>(null);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<'move' | 'reject' | 'pool' | null>(null);
  const [batchTargetStageId, setBatchTargetStageId] = useState<string | null>(null);

  const displayEntries = optimisticEntries ?? entries;

  // Debounced move to stage (300ms delay as per SPEC)
  const debouncedMove = useDebounce(
    useCallback(
      async (pipelineId: string, stageId: string) => {
        try {
          await api.pipeline.moveToStage(pipelineId, stageId);
          onRefresh();
        } catch (err) {
          setOptimisticEntries(null);
          notify.error('Failed to move candidate');
        } finally {
          setLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(pipelineId);
            return next;
          });
        }
      },
      [onRefresh]
    ),
    300
  );

  const handleDragStart = (pipelineId: string, stageId: string) => {
    setDragState({ pipelineId, sourceStageId: stageId });
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const { pipelineId, sourceStageId } = dragState;

    if (!pipelineId || sourceStageId === targetStageId) {
      setDragState({ pipelineId: null, sourceStageId: null });
      return;
    }

    const updated = entries.map((entry) =>
      entry.id === pipelineId
        ? {
            ...entry,
            currentStageId: targetStageId,
            currentStageName: stages.find((s) => s.id === targetStageId)?.name ?? null,
          }
        : entry
    );
    setOptimisticEntries(updated);
    setLoadingIds((prev) => new Set(prev).add(pipelineId));

    debouncedMove(pipelineId, targetStageId);
    setDragState({ pipelineId: null, sourceStageId: null });
  };

  const handleReject = async (pipelineId: string) => {
    try {
      await rejectCandidate(pipelineId);
      onRefresh();
    } catch (err) {
      notify.error('Failed to reject candidate');
    }
  };

  const handlePool = async (pipelineId: string) => {
    try {
      await poolCandidate(pipelineId);
      onRefresh();
    } catch (err) {
      notify.error('Failed to pool candidate');
    }
  };

  // Batch selection handlers
  const toggleSelect = (pipelineId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pipelineId)) {
        next.delete(pipelineId);
      } else {
        next.add(pipelineId);
      }
      return next;
    });
  };

  const selectAllInStage = (stageId: string) => {
    const stageEntryIds = getEntriesForStage(stageId).map((e) => e.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = stageEntryIds.every((id) => next.has(id));
      if (allSelected) {
        stageEntryIds.forEach((id) => next.delete(id));
      } else {
        stageEntryIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openBatchConfirm = (action: 'move' | 'reject' | 'pool', targetStageId?: string) => {
    if (selectedIds.size === 0) return;
    setBatchAction(action);
    setBatchTargetStageId(targetStageId || null);
    setBatchConfirmOpen(true);
  };

  const executeBatchAction = async () => {
    if (!batchAction || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      if (batchAction === 'move' && batchTargetStageId) {
        await api.pipeline.batchMove(ids, batchTargetStageId);
      } else if (batchAction === 'reject') {
        await api.pipeline.batchReject(ids);
      } else if (batchAction === 'pool') {
        // Pool one by one since there's no batch_pool command
        for (const id of ids) {
          await api.pipeline.poolCandidate(id);
        }
      }
      clearSelection();
      onRefresh();
    } catch (err) {
      notify.error('Batch action failed');
    } finally {
      setBatchConfirmOpen(false);
      setBatchAction(null);
      setBatchTargetStageId(null);
    }
  };

  const getEntriesForStage = (stageId: string) => {
    return displayEntries.filter(
      (entry) =>
        entry.currentStageId === stageId && entry.status === 'active'
    );
  };

  const actionLabel = batchAction === 'move' ? '批量推进' : batchAction === 'reject' ? '批量淘汰' : '批量入库';

  return (
    <div className="relative">
      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-xl bg-[#1a1d24] border border-[#3b82f6]/30 shadow-2xl">
          <span className="text-sm text-[#e2e8f0]">
            已选择 <span className="font-semibold text-[#3b82f6]">{selectedIds.size}</span> 人
          </span>
          <div className="w-px h-5 bg-[#2a2d35]" />
          {/* Move to stage dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#94a3b8]">推进到:</span>
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => openBatchConfirm('move', stage.id)}
                className="px-2 py-1 rounded text-xs bg-[#2a2d35] text-[#94a3b8] hover:bg-[#3b82f6]/20 hover:text-[#3b82f6] transition-colors"
              >
                {stage.name}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-[#2a2d35]" />
          <button
            onClick={() => openBatchConfirm('reject')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            淘汰
          </button>
          <button
            onClick={() => openBatchConfirm('pool')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            入库
          </button>
          <div className="w-px h-5 bg-[#2a2d35]" />
          <button
            onClick={clearSelection}
            className="p-1 rounded hover:bg-[#2a2d35] text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Batch Confirm Dialog */}
      {batchConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-xl border border-[#2a2d35] bg-[#1a1d24] shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#e2e8f0]">确认批量操作</h3>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  即将对 <span className="font-semibold text-[#3b82f6]">{selectedIds.size}</span> 位候选人执行「{actionLabel}」
                </p>
              </div>
            </div>
            <p className="text-xs text-[#64748b] mb-5">此操作不可撤销，是否继续？</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBatchConfirmOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#94a3b8] hover:bg-[#2a2d35] transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeBatchAction}
                className="px-4 py-2 rounded-lg text-sm bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors"
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageEntries = getEntriesForStage(stage.id);
          const isDropTarget = dragState.sourceStageId !== stage.id;
          const allSelected = stageEntries.length > 0 && stageEntries.every((e) => selectedIds.has(e.id));

          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-72 rounded-xl border bg-[#1a1d24] flex flex-col max-h-[calc(100vh-280px)] ${
                isDropTarget
                  ? 'border-[#2a2d35]'
                  : 'border-[#3b82f6]/50 bg-[#3b82f6]/5'
              }`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d35]">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-[#e2e8f0]">
                    {stage.name}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2d35] text-[#94a3b8]">
                    {stageEntries.length}
                  </span>
                </div>
                {stageEntries.length > 0 && (
                  <button
                    onClick={() => selectAllInStage(stage.id)}
                    className="p-1 rounded hover:bg-[#2a2d35] text-[#94a3b8] transition-colors"
                    title={allSelected ? '取消全选' : '全选'}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#3b82f6]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* Entries */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {stageEntries.map((entry) => {
                  const isSelected = selectedIds.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={() => handleDragStart(entry.id, stage.id)}
                      className={`rounded-lg border p-3 cursor-move transition-colors ${
                        isSelected
                          ? 'border-[#3b82f6]/50 bg-[#3b82f6]/10'
                          : 'border-[#2a2d35] bg-[#0f1117] hover:border-[#3b82f6]/30'
                      } ${loadingIds.has(entry.id) ? 'opacity-50' : ''}`}
                    >
                      {/* Checkbox + Name */}
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(entry.id);
                          }}
                          className="shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#3b82f6]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#64748b]" />
                          )}
                        </button>
                        <div className="w-7 h-7 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-[#3b82f6]" />
                        </div>
                        <span className="text-sm font-medium text-[#e2e8f0] truncate">
                          {entry.candidateName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 pl-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(entry.id)}
                          className="h-7 px-2 text-xs text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-3 h-3 mr-1" />
                          淘汰
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePool(entry.id)}
                          className="h-7 px-2 text-xs text-[#94a3b8] hover:text-[#3b82f6] hover:bg-[#3b82f6]/10"
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          入库
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {stageEntries.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-[#64748b]">暂无候选人</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KanbanBoard;
