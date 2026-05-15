import { useState } from 'react';
import type { PipelineStage } from '@/types';
import { usePipelineStore } from '@/stores/pipelineStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Settings,
  Save,
} from 'lucide-react';

interface PipelineConfigProps {
  jobId: string;
  jobTitle?: string;
}

function PipelineConfig({ jobId, jobTitle }: PipelineConfigProps) {
  const {
    stages,
    loading,
    error,
    createStage,
    updateStage,
    deleteStage,
    initDefaultStages,
  } = usePipelineStore();

  const [newStageName, setNewStageName] = useState('');
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingStage, setDeletingStage] = useState<PipelineStage | null>(null);

  // Save as template state
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    const maxOrder = stages.length > 0
      ? Math.max(...stages.map((s) => s.sortOrder))
      : 0;
    await createStage(jobId, newStageName.trim(), maxOrder + 1);
    setNewStageName('');
  };

  const handleEdit = (stage: PipelineStage) => {
    setEditingStage(stage);
    setEditName(stage.name);
  };

  const handleSaveEdit = async () => {
    if (!editingStage || !editName.trim()) return;
    await updateStage(editingStage.id, { name: editName.trim() });
    setEditingStage(null);
  };

  const handleDelete = (stage: PipelineStage) => {
    setDeletingStage(stage);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingStage) return;
    await deleteStage(deletingStage.id);
    setDeleteDialogOpen(false);
    setDeletingStage(null);
  };

  const handleInitDefaults = async () => {
    await initDefaultStages(jobId);
  };

  const openSaveTemplate = () => {
    setTemplateName(jobTitle ? `${jobTitle} 流程` : '流程模板');
    setSaveError('');
    setSaveTemplateOpen(true);
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      setSaveError('模板名称不能为空');
      return;
    }
    if (stages.length === 0) {
      setSaveError('当前没有阶段可保存');
      return;
    }
    setSavingTemplate(true);
    setSaveError('');
    try {
      const stagesJson = JSON.stringify(
        stages.map((s, idx) => ({ name: s.name, sortOrder: s.sortOrder ?? idx }))
      );
      await api.pipelineTemplates.create(name, stagesJson);
      setSaveTemplateOpen(false);
      setTemplateName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#e2e8f0]">招聘流程阶段</h3>
        <div className="flex items-center gap-2">
          {stages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={openSaveTemplate}
              className="border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a1d24]"
            >
              <Save className="w-4 h-4 mr-1" />
              保存为流程模板
            </Button>
          )}
          {stages.length === 0 && (
            <Button
              onClick={handleInitDefaults}
              disabled={loading}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              初始化默认阶段
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stages List */}
      {stages.length > 0 && (
        <div className="space-y-2">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 rounded-lg border border-[#2a2d35] bg-[#1a1d24] px-4 py-3"
            >
              <GripVertical className="w-4 h-4 text-[#64748b] shrink-0" />
              <span className="text-xs text-[#64748b] w-6">{index + 1}</span>

              {editingStage?.id === stage.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 bg-[#0f1117] border-[#2a2d35] text-[#e2e8f0]"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-8"
                  >
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingStage(null)}
                    className="text-[#94a3b8] hover:text-[#e2e8f0] h-8"
                  >
                    取消
                  </Button>
                </div>
              ) : (
                <>
                  <span
                    className="flex-1 text-sm text-[#e2e8f0] cursor-pointer hover:text-[#3b82f6]"
                    onClick={() => handleEdit(stage)}
                  >
                    {stage.name}
                  </span>
                  {stage.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6]">
                      默认
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(stage)}
                    className="text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Stage */}
      {stages.length > 0 && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="新阶段名称"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
            className="flex-1 bg-[#1a1d24] border-[#2a2d35] text-[#e2e8f0] placeholder:text-[#64748b]"
          />
          <Button
            onClick={handleAddStage}
            disabled={!newStageName.trim() || loading}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加
          </Button>
        </div>
      )}

      {/* Empty State */}
      {stages.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2d35] bg-[#1a1d24] py-12">
          <Settings className="w-10 h-10 mb-3 text-[#3b82f6]" />
          <p className="text-sm text-[#94a3b8]">暂无流程阶段</p>
          <p className="text-xs text-[#64748b] mt-1">
            点击「初始化默认阶段」创建标准招聘流程
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除阶段</DialogTitle>
            <DialogDescription>
              确定要删除阶段「{deletingStage?.name}」吗？此操作不可恢复。
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
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>保存为流程模板</DialogTitle>
            <DialogDescription>
              将当前阶段配置保存为模板，方便以后新建职位时复用
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                模板名称
              </label>
              <Input
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  if (saveError) setSaveError('');
                }}
                placeholder="输入模板名称"
                maxLength={100}
              />
            </div>
            {saveError && (
              <p className="text-xs text-red-400">{saveError}</p>
            )}
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
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {savingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PipelineConfig;
