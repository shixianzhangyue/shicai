import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { JobTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Trash2, Plus, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface TemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelect?: (template: JobTemplate) => void;
}

function TemplateManager({ open, onOpenChange, onTemplateSelect }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<JobTemplate | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');

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
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

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

  const handleCreateTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) return;
    try {
      const template = await api.jobTemplates.create({
        name: newTemplateName.trim(),
        content: newTemplateContent,
      });
      setTemplates((prev) => [template, ...prev]);
      setNewTemplateName('');
      setNewTemplateContent('');
      setCreateDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, [newTemplateName, newTemplateContent]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>管理职位模板</DialogTitle>
            <DialogDescription>
              创建、编辑和删除职位模板，快速填充职位信息
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建模板
            </Button>
          </div>

          {loading && templates.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
              <span className="ml-2 text-sm text-[#94a3b8]">加载中...</span>
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10">
              <FileText className="w-10 h-10 mb-3 text-[#94a3b8]" />
              <p className="text-sm text-[#94a3b8]">暂无职位模板</p>
              <p className="text-xs text-[#64748b] mt-1">
                点击「新建模板」创建第一个模板
              </p>
            </div>
          )}

          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="group flex items-center justify-between rounded-lg border border-[#2a2d35] bg-[#1a1d24] px-4 py-3 hover:border-[#3b82f6]/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#3b82f6] shrink-0" />
                    <p className="text-sm font-medium text-[#e2e8f0] truncate">
                      {template.name}
                    </p>
                  </div>
                  <p className="text-xs text-[#94a3b8] mt-1">
                    创建于 {formatDate(template.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onTemplateSelect && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTemplateSelect(template)}
                      className="text-[#94a3b8] hover:text-[#3b82f6] hover:bg-[#3b82f6]/10"
                    >
                      使用
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(template)}
                    className="text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
              >
                关闭
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建职位模板</DialogTitle>
            <DialogDescription>
              创建一个新的职位模板，方便快速创建职位
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#e2e8f0] mb-1.5 block">
                模板名称
              </label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="例如：高级前端工程师"
                className="bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#e2e8f0] mb-1.5 block">
                模板内容
              </label>
              <Textarea
                value={newTemplateContent}
                onChange={(e) => setNewTemplateContent(e.target.value)}
                placeholder="输入职位描述、要求等模板内容..."
                rows={6}
                className="bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0]"
              />
            </div>
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
            <Button
              onClick={handleCreateTemplate}
              disabled={!newTemplateName.trim()}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TemplateManager;
