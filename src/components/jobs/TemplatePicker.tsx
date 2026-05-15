import { useState, useEffect } from 'react';
import type { JobTemplate } from '@/types';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Trash2 } from 'lucide-react';

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: JobTemplate) => void;
}

function TemplatePicker({ open, onOpenChange, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.jobTemplates.list();
      setTemplates(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.jobTemplates.delete(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>选择职位模板</DialogTitle>
          <DialogDescription>
            从已保存的模板快速填充职位信息
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
            <span className="ml-2 text-sm text-[#94a3b8]">加载中...</span>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 py-2">{error}</p>
        )}

        {!loading && templates.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-10">
            <FileText className="w-10 h-10 mb-3 text-[#94a3b8]" />
            <p className="text-sm text-[#94a3b8]">暂无保存的模板</p>
            <p className="text-xs text-[#64748b] mt-1">
              在创建职位时点击「保存为模板」即可添加
            </p>
          </div>
        )}

        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => {
                onSelect(template);
                onOpenChange(false);
              }}
              className="group flex items-center justify-between rounded-lg border border-[#2a2d35] bg-[#1a1d24] px-4 py-3 cursor-pointer hover:border-[#3b82f6]/50 hover:bg-[#1e2129] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#e2e8f0] truncate">
                  {template.name}
                </p>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  创建于 {formatDate(template.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDelete(e, template.id)}
                className="opacity-0 group-hover:opacity-100 text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10 shrink-0 ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="ghost"
              className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
            >
              取消
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePicker;
