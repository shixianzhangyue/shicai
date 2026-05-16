import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useTagStore } from "@/stores/tagStore";
import BackupRestore from "@/components/settings/BackupRestore";
import ExportConfig from "@/components/settings/ExportConfig";
import LlmConfigPanel from "@/components/settings/LlmConfigPanel";
import OcrConfigPanel from "@/components/settings/OcrConfigPanel";
import { Tag, Pencil, Trash2, Plus, AlertTriangle, Download } from "lucide-react";

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1",
  "#84cc16", "#f97316", "#14b8a6", "#a855f7",
];

function Settings() {
  const { tags, loading, fetchTags, createTag, updateTag, deleteTag } = useTagStore();

  // Tag form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color: string } | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");
  const [tagError, setTagError] = useState("");

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const openCreateDialog = () => {
    setEditingTag(null);
    setTagName("");
    setTagColor("#3b82f6");
    setTagError("");
    setDialogOpen(true);
  };

  const openEditDialog = (tag: { id: string; name: string; color: string }) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setTagError("");
    setDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingTagId(id);
    setDeleteDialogOpen(true);
  };

  const handleSaveTag = async () => {
    const name = tagName.trim();
    if (!name) {
      setTagError("标签名称不能为空");
      return;
    }
    if (name.length > 20) {
      setTagError("标签名称不能超过 20 个字符");
      return;
    }

    try {
      if (editingTag) {
        await updateTag(editingTag.id, { name, color: tagColor });
      } else {
        await createTag(name, tagColor);
      }
      setTagError("");
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE") || msg.includes("duplicate") || msg.includes("已存在")) {
        setTagError("标签名称已存在");
      } else {
        setTagError(msg);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingTagId) {
      await deleteTag(deletingTagId);
    }
    setDeleteDialogOpen(false);
    setDeletingTagId(null);
  };

  const deletingTag = tags.find((t) => t.id === deletingTagId);

  return (
    <PageLayout title="设置" description="配置系统参数、标签管理和数据导出">
      <div className="max-w-3xl space-y-8">
        {/* Data Management Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#e2e8f0]">数据管理</h2>
              <p className="text-sm text-[#94a3b8]">导出、备份与恢复数据</p>
            </div>
            <Button
              onClick={() => setExportDialogOpen(true)}
              className="inline-flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              size="sm"
            >
              <Download className="w-4 h-4" />
              导出数据
            </Button>
          </div>
          <BackupRestore />
        </section>

        {/* Tag Management Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#e2e8f0]">标签管理</h2>
              <p className="text-sm text-[#94a3b8]">管理用于职位和候选人的标签</p>
            </div>
            <Button
              onClick={openCreateDialog}
              className="inline-flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              新建标签
            </Button>
          </div>

          {/* Tag list */}
          <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-[#2a2d35] border-t-[#3b82f6] animate-spin" />
                <p className="text-sm text-[#94a3b8]">加载中...</p>
              </div>
            ) : tags.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="w-10 h-10 mx-auto mb-3 text-[#94a3b8]" />
                <p className="text-sm text-[#94a3b8]">暂无标签，点击上方按钮创建</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2a2d35]">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-[#0f1117]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm font-medium text-[#e2e8f0]">
                        {tag.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditDialog(tag)}
                        className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteDialog(tag.id)}
                        className="p-1.5 rounded-md text-[#94a3b8] hover:text-red-400 hover:bg-[#2a2d35] transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Resume Parsing Config Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#e2e8f0]">简历解析配置</h2>
              <p className="text-sm text-[#94a3b8]">配置 LLM 智能解析和 OCR 图片识别</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-[#e2e8f0] mb-3">LLM 配置</h3>
              <p className="text-xs text-[#94a3b8] mb-3">用于智能解析简历文本，提取结构化信息</p>
              <LlmConfigPanel />
            </div>

            <div className="border-t border-[#2a2d35] pt-6">
              <h3 className="text-sm font-medium text-[#e2e8f0] mb-3">OCR 配置（可选）</h3>
              <p className="text-xs text-[#94a3b8] mb-3">用于识别图片型简历（扫描件PDF、图片文件）。未配置时，图片型简历将无法解析。</p>
              <OcrConfigPanel />
            </div>
          </div>
        </section>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "编辑标签" : "新建标签"}
            </DialogTitle>
            <DialogDescription>
              {editingTag
                ? "修改标签的名称和颜色"
                : "创建一个新标签用于分类职位和候选人"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                标签名称
              </label>
              <Input
                value={tagName}
                onChange={(e) => {
                  setTagName(e.target.value);
                  if (tagError) setTagError("");
                }}
                placeholder="输入标签名称"
                maxLength={20}
              />
              {tagError && (
                <p className="text-xs text-red-400">{tagError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                标签颜色
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTagColor(color)}
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      tagColor === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a1d24]"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#94a3b8]">自定义:</span>
                <input
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <span className="text-xs text-[#94a3b8] font-mono">
                  {tagColor}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]">
                取消
              </Button>
            </DialogClose>
            <Button
              onClick={handleSaveTag}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {editingTag ? "保存修改" : "创建标签"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要删除标签
              {deletingTag && (
                <span
                  className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: deletingTag.color }}
                >
                  {deletingTag.name}
                </span>
              )}
              吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]">
                取消
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Config Dialog */}
      <ExportConfig open={exportDialogOpen} onOpenChange={setExportDialogOpen} />
    </PageLayout>
  );
}

export default Settings;
