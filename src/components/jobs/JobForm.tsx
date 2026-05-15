import { useState, useEffect } from 'react';
import type { Job, JobStatus, JobTemplate, PipelineTemplate } from '@/types';
import { useJobStore } from '@/stores/jobStore';
import { useTagStore } from '@/stores/tagStore';
import { api } from '@/lib/api';
import TemplatePicker from './TemplatePicker';
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
import { Input } from '@/components/ui/input';
import TagPicker from '@/components/ui/TagPicker';
import { Save, FileText, Loader2, Workflow } from 'lucide-react';

interface JobFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingJob?: Job | null;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'open', label: '开放' },
  { value: 'paused', label: '暂停' },
  { value: 'closed', label: '关闭' },
];

function JobForm({ open, onOpenChange, editingJob }: JobFormProps) {
  const { tags, fetchTags } = useTagStore();
  const createJob = useJobStore((s) => s.createJob);
  const updateJob = useJobStore((s) => s.updateJob);

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [status, setStatus] = useState<JobStatus>('draft');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Template-related state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState('');

  // Pipeline template state
  const [pipelineTemplates, setPipelineTemplates] = useState<PipelineTemplate[]>([]);
  const [selectedPipelineTemplateId, setSelectedPipelineTemplateId] = useState<string>('');
  const [pipelineTemplatePreview, setPipelineTemplatePreview] = useState<string[]>([]);
  const [loadingPipelineTemplates, setLoadingPipelineTemplates] = useState(false);

  const isEditing = !!editingJob;

  useEffect(() => {
    if (open) {
      fetchTags();
      if (editingJob) {
        setTitle(editingJob.title);
        setDepartment(editingJob.department ?? '');
        setSalaryMin(editingJob.salaryMin?.toString() ?? '');
        setSalaryMax(editingJob.salaryMax?.toString() ?? '');
        setDescription(editingJob.description ?? '');
        setRequirements(editingJob.requirements ?? '');
        setStatus(editingJob.status);
        setSelectedTagIds(editingJob.tags ?? []);
        setSelectedPipelineTemplateId('');
        setPipelineTemplatePreview([]);
      } else {
        setTitle('');
        setDepartment('');
        setSalaryMin('');
        setSalaryMax('');
        setDescription('');
        setRequirements('');
        setStatus('draft');
        setSelectedTagIds([]);
        setSelectedPipelineTemplateId('');
        setPipelineTemplatePreview([]);
      }
      setFormError('');
      setTemplateName('');
      setSaveTemplateError('');

      // Load pipeline templates for new jobs
      if (!editingJob) {
        setLoadingPipelineTemplates(true);
        api.pipelineTemplates
          .list()
          .then((list) => setPipelineTemplates(list))
          .catch(() => {})
          .finally(() => setLoadingPipelineTemplates(false));
      }
    }
  }, [open, editingJob, fetchTags]);

  useEffect(() => {
    if (!selectedPipelineTemplateId) {
      setPipelineTemplatePreview([]);
      return;
    }
    const tpl = pipelineTemplates.find((t) => t.id === selectedPipelineTemplateId);
    if (tpl) {
      try {
        const stages = JSON.parse(tpl.stagesJson) as Array<{ name: string }>;
        setPipelineTemplatePreview(stages.map((s) => s.name));
      } catch {
        setPipelineTemplatePreview([]);
      }
    }
  }, [selectedPipelineTemplateId, pipelineTemplates]);

  const validate = (): boolean => {
    const t = title.trim();
    if (!t) {
      setFormError('职位标题不能为空');
      return false;
    }
    if (t.length > 200) {
      setFormError('职位标题不能超过 200 个字符');
      return false;
    }
    const min = salaryMin ? parseFloat(salaryMin) : null;
    const max = salaryMax ? parseFloat(salaryMax) : null;
    if (min !== null && min < 0) {
      setFormError('薪资下限不能为负数');
      return false;
    }
    if (max !== null && max < 0) {
      setFormError('薪资上限不能为负数');
      return false;
    }
    if (min !== null && max !== null && max < min) {
      setFormError('薪资上限不能低于下限');
      return false;
    }
    setFormError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        department: department.trim() || null,
        salaryMin: salaryMin ? parseFloat(salaryMin) : null,
        salaryMax: salaryMax ? parseFloat(salaryMax) : null,
        description: description.trim() || null,
        requirements: requirements.trim() || null,
        status,
        tags: selectedTagIds,
      };
      if (isEditing && editingJob) {
        await updateJob(editingJob.id, payload);
      } else {
        const job = await createJob(payload);
        if (selectedPipelineTemplateId) {
          const tpl = pipelineTemplates.find((t) => t.id === selectedPipelineTemplateId);
          if (tpl) {
            try {
              const stages = JSON.parse(tpl.stagesJson) as Array<{ name: string; sortOrder?: number }>;
              for (let i = 0; i < stages.length; i++) {
                await api.pipeline.createStage(job.id, stages[i].name, stages[i].sortOrder ?? i);
              }
            } catch {
              // Fallback to default stages if template parsing fails
              await api.pipeline.initDefaultStages(job.id);
            }
          }
        } else {
          await api.pipeline.initDefaultStages(job.id);
        }
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTemplate = (template: JobTemplate) => {
    try {
      const content = JSON.parse(template.content) as Partial<Job>;
      if (content.title !== undefined) setTitle(content.title);
      if (content.department !== undefined) setDepartment(content.department ?? '');
      if (content.salaryMin !== undefined) setSalaryMin(content.salaryMin?.toString() ?? '');
      if (content.salaryMax !== undefined) setSalaryMax(content.salaryMax?.toString() ?? '');
      if (content.description !== undefined) setDescription(content.description ?? '');
      if (content.requirements !== undefined) setRequirements(content.requirements ?? '');
      if (content.status !== undefined) setStatus(content.status);
      if (content.tags !== undefined) setSelectedTagIds(content.tags);
    } catch {
      setFormError('模板数据解析失败');
    }
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      setSaveTemplateError('模板名称不能为空');
      return;
    }
    setSavingTemplate(true);
    setSaveTemplateError('');
    try {
      const content = JSON.stringify({
        title: title.trim(),
        department: department.trim() || null,
        salaryMin: salaryMin ? parseFloat(salaryMin) : null,
        salaryMax: salaryMax ? parseFloat(salaryMax) : null,
        description: description.trim() || null,
        requirements: requirements.trim() || null,
        status,
        tags: selectedTagIds,
      });
      await api.jobTemplates.create(name, content);
      setSaveTemplateOpen(false);
      setTemplateName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveTemplateError(msg);
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? '编辑职位' : '新建职位'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? '修改职位信息并保存'
                : '填写职位基本信息，创建新的招聘需求'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                职位标题 <span className="text-red-400">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="输入职位标题"
                maxLength={200}
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                所属部门
              </label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="输入所属部门"
              />
            </div>

            {/* Salary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  薪资下限
                </label>
                <Input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => {
                    setSalaryMin(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="例如 15"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  薪资上限
                </label>
                <Input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => {
                    setSalaryMax(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="例如 25"
                  min={0}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                职位描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入职位描述"
                rows={3}
                className="flex w-full rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                岗位要求
              </label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="输入岗位要求"
                rows={3}
                className="flex w-full rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                状态 <span className="text-red-400">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobStatus)}
                className="flex h-10 w-full rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                标签
              </label>
              <TagPicker
                tags={tags}
                selectedIds={selectedTagIds}
                onChange={setSelectedTagIds}
                placeholder="选择标签..."
              />
            </div>

            {/* Pipeline Template (new mode only) */}
            {!isEditing && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0] flex items-center gap-1">
                  <Workflow className="w-3.5 h-3.5" />
                  流程模板
                </label>
                <select
                  value={selectedPipelineTemplateId}
                  onChange={(e) => setSelectedPipelineTemplateId(e.target.value)}
                  disabled={loadingPipelineTemplates}
                  className="flex h-10 w-full rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <option value="">使用默认流程</option>
                  {pipelineTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                {loadingPipelineTemplates && (
                  <p className="text-xs text-[#64748b]">加载模板中...</p>
                )}
                {pipelineTemplatePreview.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {pipelineTemplatePreview.map((name, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6]"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formError && (
              <p className="text-xs text-red-400">{formError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            {!isEditing && (
              <Button
                variant="outline"
                onClick={() => setTemplatePickerOpen(true)}
                className="border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a1d24]"
              >
                <FileText className="w-4 h-4 mr-1" />
                从模板创建
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setTemplateName(title.trim() || '职位模板');
                setSaveTemplateOpen(true);
              }}
              className="border-[#2a2d35] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a1d24]"
            >
              <Save className="w-4 h-4 mr-1" />
              保存为模板
            </Button>
            <DialogClose asChild>
              <Button
                variant="ghost"
                className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
              >
                取消
              </Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : isEditing ? (
                '保存修改'
              ) : (
                '创建职位'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker */}
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleSelectTemplate}
      />

      {/* Save Template Dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>保存为模板</DialogTitle>
            <DialogDescription>
              将当前表单内容保存为职位模板，方便以后快速创建
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
                  if (saveTemplateError) setSaveTemplateError('');
                }}
                placeholder="输入模板名称"
                maxLength={100}
              />
            </div>
            {saveTemplateError && (
              <p className="text-xs text-red-400">{saveTemplateError}</p>
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
                '保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default JobForm;
