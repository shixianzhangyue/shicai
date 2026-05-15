import { useState, useEffect, useCallback } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { api } from '@/lib/api';
import type { JobTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Trash2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

function JobTemplates() {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<JobTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openDeleteDialog = useCallback((template: JobTemplate) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTemplate) return;
    try {
      await api.jobTemplates.delete(deletingTemplate.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
    setDeleteDialogOpen(false);
    setDeletingTemplate(null);
  }, [deletingTemplate]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <PageLayout title="职位模板" description="管理职位模板，快速创建新职位">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && templates.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
          <span className="ml-3 text-sm text-[#94a3b8]">加载中...</span>
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2d35] bg-[#1a1d24] py-16">
          <FileText className="w-12 h-12 mb-4 text-[#3b82f6]" />
          <h2 className="text-lg font-medium text-[#e2e8f0] mb-2">暂无职位模板</h2>
          <p className="text-sm text-[#94a3b8] mb-6">
            在创建或编辑职位时点击「保存为模板」即可添加
          </p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5 hover:border-[#3b82f6]/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-[#3b82f6] shrink-0" />
                  <h3 className="text-sm font-medium text-[#e2e8f0] truncate">
                    {template.name}
                  </h3>
                </div>
              </div>
              <p className="text-xs text-[#94a3b8] mb-4">
                创建于 {formatDate(template.createdAt)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDeleteDialog(template)}
                className="text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                删除
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除模板</DialogTitle>
            <DialogDescription>
              确定要删除模板「{deletingTemplate?.name}」吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
              >
                取消
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

export default JobTemplates;
