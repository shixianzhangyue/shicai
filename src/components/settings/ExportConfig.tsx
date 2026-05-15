import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ExportableFieldMeta, ExportableField, Job } from '@/types';
import { save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Download, Loader2 } from 'lucide-react';

interface ExportConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SortableFieldItem({ id, label }: { id: string; label: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 ${
        isDragging ? 'opacity-80 shadow-lg' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-[#64748b] hover:text-[#e2e8f0] cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-sm text-[#e2e8f0]">{label}</span>
    </div>
  );
}

function ExportConfig({ open, onOpenChange }: ExportConfigProps) {
  const [fieldsMeta, setFieldsMeta] = useState<ExportableFieldMeta[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<ExportableField>>(new Set());
  const [fieldOrder, setFieldOrder] = useState<ExportableField[]>([]);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [scope, setScope] = useState<'all' | 'filtered' | 'job'>('all');
  const [jobId, setJobId] = useState<string>('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setError('');
    Promise.all([api.export.fields(), api.jobs.list()])
      .then(([meta, jobList]) => {
        setFieldsMeta(meta);
        const allKeys = meta.map((m) => m.key);
        setSelectedFields(new Set(allKeys));
        setFieldOrder(allKeys);
        setJobs(jobList);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      })
      .finally(() => setFetching(false));
  }, [open]);

  const toggleField = useCallback((key: ExportableField) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
    setFieldOrder((prev) => {
      const exists = prev.includes(key);
      if (exists) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allKeys = fieldsMeta.map((m) => m.key);
    if (selectedFields.size === allKeys.length) {
      // Keep at least one
      setSelectedFields(new Set([allKeys[0]]));
      setFieldOrder([allKeys[0]]);
    } else {
      setSelectedFields(new Set(allKeys));
      setFieldOrder(allKeys);
    }
  }, [fieldsMeta, selectedFields.size]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setFieldOrder((items) => {
          const oldIndex = items.indexOf(active.id as ExportableField);
          const newIndex = items.indexOf(over.id as ExportableField);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    },
    []
  );

  const visibleOrderedFields = fieldOrder.filter((k) => selectedFields.has(k));

  const handleExport = async () => {
    if (selectedFields.size === 0) {
      setError('至少选择一个字段');
      return;
    }
    if (scope === 'job' && !jobId) {
      setError('请选择一个职位');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const config = {
        fields: Array.from(selectedFields),
        fieldOrder: visibleOrderedFields,
        format,
        scope,
        jobId: scope === 'job' ? jobId : undefined,
      };
      const result = await api.export.export(config);

      const defaultName = `candidates-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      const path = await save({
        defaultPath: defaultName,
        filters: [
          {
            name: format === 'xlsx' ? 'Excel' : 'CSV',
            extensions: [format],
          },
        ],
      });
      if (!path) {
        setLoading(false);
        return;
      }

      // Generate file with SheetJS
      const headers = result.fieldOrder.map((key) => {
        const meta = fieldsMeta.find((m) => m.key === key);
        return meta?.label ?? key;
      });
      const rows = result.data.map((row) =>
        result.fieldOrder.map((key) => (row as Record<string, string>)[key] ?? '')
      );
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');

      if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(ws);
        await import('@tauri-apps/plugin-fs').then(({ writeTextFile }) =>
          writeTextFile(path, csv)
        );
      } else {
        await import('@tauri-apps/plugin-fs').then(({ writeFile }) =>
          writeFile(path, new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })))
        );
      }

      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导出数据</DialogTitle>
          <DialogDescription>
            选择需要导出的字段并调整顺序，生成 Excel/CSV 文件
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Field selection + ordering */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: field checkboxes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#e2e8f0]">
                    选择字段
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    className="text-xs text-[#3b82f6] hover:text-[#2563eb] h-7"
                  >
                    {selectedFields.size === fieldsMeta.length
                      ? '取消全选'
                      : '全选'}
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {fieldsMeta.map((meta) => (
                    <label
                      key={meta.key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedFields.has(meta.key)}
                        onCheckedChange={() => toggleField(meta.key)}
                      />
                      <span className="text-sm text-[#e2e8f0]">
                        {meta.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Right: sortable ordered fields */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-[#e2e8f0]">
                  排序字段
                </span>
                <div className="rounded-lg border border-[#2a2d35] bg-[#1a1d24] p-3 max-h-64 overflow-y-auto">
                  {visibleOrderedFields.length === 0 ? (
                    <p className="text-xs text-[#64748b] text-center py-4">
                      勾选字段后在此拖拽排序
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={visibleOrderedFields}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {visibleOrderedFields.map((key) => {
                            const meta = fieldsMeta.find((m) => m.key === key);
                            return (
                              <SortableFieldItem
                                key={key}
                                id={key}
                                label={meta?.label ?? key}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </div>

            {/* Format and scope */}
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-medium text-[#e2e8f0]">
                  导出格式
                </span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="xlsx"
                      checked={format === 'xlsx'}
                      onChange={() => setFormat('xlsx')}
                      className="accent-[#3b82f6]"
                    />
                    <span className="text-sm text-[#e2e8f0]">Excel (.xlsx)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={format === 'csv'}
                      onChange={() => setFormat('csv')}
                      className="accent-[#3b82f6]"
                    />
                    <span className="text-sm text-[#e2e8f0]">CSV (.csv)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-[#e2e8f0]">
                  导出范围
                </span>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="all"
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                      className="accent-[#3b82f6]"
                    />
                    <span className="text-sm text-[#e2e8f0]">全部</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="job"
                      checked={scope === 'job'}
                      onChange={() => setScope('job')}
                      className="accent-[#3b82f6]"
                    />
                    <span className="text-sm text-[#e2e8f0]">某职位</span>
                  </label>
                </div>
                {scope === 'job' && (
                  <select
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    className="h-10 w-full rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
                  >
                    <option value="">选择职位...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || selectedFields.size === 0}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            确认导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportConfig;
