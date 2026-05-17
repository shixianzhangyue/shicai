import { useState, useEffect, useCallback } from 'react';
import type { ParsedResume } from '@/types';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Check, Loader2, Sparkles, Info } from 'lucide-react';

interface ParsePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ParsedResume | null;
  onConfirm: (result: ParsedResume) => void;
}

// All field keys that can be marked for re-identification
const ALL_FIELD_KEYS = [
  'name', 'phone', 'email', 'gender', 'birthDate',
  'currentCompany', 'currentPosition', 'education', 'yearsExp',
  'expectedSalary', 'expectedCity', 'selfIntroduction',
  'skills', 'workExperiences', 'projectExperiences',
] as const;

const FIELD_LABELS: Record<string, string> = {
  name: '姓名',
  phone: '手机号',
  email: '邮箱',
  gender: '性别',
  birthDate: '出生日期',
  currentCompany: '当前公司',
  currentPosition: '当前职位',
  education: '学历',
  yearsExp: '工作年限',
  expectedSalary: '期望薪资',
  expectedCity: '期望城市',
  selfIntroduction: '自我介绍',
  skills: '技能',
  workExperiences: '工作经历',
  projectExperiences: '项目经历',
};

// Threshold to auto-trigger AI enhancement
const AUTO_ENHANCE_THRESHOLD = 3;

function ParsePreviewDialog({ open, onOpenChange, data, onConfirm }: ParsePreviewDialogProps) {
  const [edited, setEdited] = useState<ParsedResume | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [markedFields, setMarkedFields] = useState<Set<string>>(new Set());
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [autoEnhanceTriggered, setAutoEnhanceTriggered] = useState(false);

  // When data changes, reset edited state
  const currentData = edited ?? data;

  // Auto-trigger AI enhancement when >3 fields are marked
  useEffect(() => {
    if (markedFields.size > AUTO_ENHANCE_THRESHOLD && !autoEnhanceTriggered && !isEnhancing) {
      setAutoEnhanceTriggered(true);
      handleAiEnhance();
    }
  }, [markedFields.size, autoEnhanceTriggered, isEnhancing]);

  const handleFieldMark = (fieldKey: string) => {
    setMarkedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  };

  const handleAiEnhance = useCallback(async () => {
    if (!currentData || markedFields.size === 0) return;

    setIsEnhancing(true);
    setEnhanceError(null);

    try {
      const rawTextFull = currentData.rawTextFull || currentData.rawTextPreview;
      const fieldsArray = Array.from(markedFields);

      const enhanced = await api.resumeParser.parseEnhance(
        rawTextFull,
        currentData,
        fieldsArray,
      );

      // Merge: overwrite edited state with enhanced result
      setEdited({ ...currentData, ...enhanced });
      setMarkedFields(new Set());
      setAutoEnhanceTriggered(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnhanceError(msg);
    } finally {
      setIsEnhancing(false);
    }
  }, [currentData, markedFields]);

  const handleChange = (field: keyof ParsedResume, value: unknown) => {
    if (!currentData) return;
    setEdited({ ...currentData, [field]: value } as ParsedResume);
  };

  const handleConfirm = () => {
    if (currentData) {
      onConfirm(currentData);
      setEdited(null);
      setMarkedFields(new Set());
      setAutoEnhanceTriggered(false);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setEdited(null);
    setMarkedFields(new Set());
    setAutoEnhanceTriggered(false);
    onOpenChange(false);
  };

  if (!currentData) return null;

  const parseSource = currentData.parseSource || 'llm';
  const isAiEnhanced = parseSource === 'ai_enhanced';
  const isOcrOnly = parseSource === 'ocr' || parseSource === 'text';

  // Field row wrapper: renders label + mark button + input
  const FieldRow = ({
    fieldKey,
    label,
    children,
    className = '',
  }: {
    fieldKey: string;
    label: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    const isMarked = markedFields.has(fieldKey);
    return (
      <div className={`space-y-1 relative group ${className}`}>
        <div className="flex items-center gap-1.5">
          <Label className="text-[#94a3b8]">{label}</Label>
          {!isOcrOnly && (
            <button
              type="button"
              onClick={() => handleFieldMark(fieldKey)}
              className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                isMarked
                  ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40'
                  : 'bg-[#2a2d35] text-[#94a3b8] hover:bg-[#3a3d45] border border-transparent opacity-0 group-hover:opacity-100'
              }`}
            >
              {isMarked ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  <span>需重识别</span>
                </>
              ) : (
                <span>标记</span>
              )}
            </button>
          )}
        </div>
        {children}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>解析结果预览</DialogTitle>
              <DialogDescription>
                请核对并编辑提取的信息，确认后填充到表单中
              </DialogDescription>
            </div>
            {/* Parse source badge */}
            <div className="flex items-center gap-1.5">
              {isAiEnhanced ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#8b5cf6]/20 text-[#a78bfa] border border-[#8b5cf6]/30">
                  <Sparkles className="w-3 h-3" />
                  AI 增强
                </span>
              ) : isOcrOnly ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/30">
                  {parseSource === 'ocr' ? 'OCR 提取' : '文本提取'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                  LLM 解析
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* OCR-only mode tip */}
        {isOcrOnly && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-sm text-[#fbbf24]">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>当前为 {parseSource === 'ocr' ? 'OCR' : '文本'} 提取模式，仅提取了原始文本。请手动填写各字段，或在设置中配置 LLM 后使用 AI 自动解析。</span>
          </div>
        )}

        {/* Enhancement controls (only available when LLM is configured) */}
        {!isOcrOnly && markedFields.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1d25] border border-[#2a2d35]">
            <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
              <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
              <span>已标记 <strong className="text-[#e2e8f0]">{markedFields.size}</strong> 个字段需要重新识别</span>
            </div>
            <Button
              onClick={handleAiEnhance}
              disabled={isEnhancing}
              className="ml-auto bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm"
              size="sm"
            >
              {isEnhancing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  AI 识别中...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI 重新识别
                </>
              )}
            </Button>
          </div>
        )}

        {enhanceError && (
          <div className="p-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-sm text-[#ef4444]">
            增强失败: {enhanceError}
          </div>
        )}

        {isEnhancing && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 text-sm text-[#a78bfa]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI 正在重新识别标记的字段，预计需要 10-30 秒...</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {/* Left: raw text preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>原文预览</Label>
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs text-[#3b82f6] hover:underline"
              >
                {showRaw ? '收起' : '展开'}
              </button>
            </div>
            <Textarea
              value={currentData.rawTextPreview}
              readOnly
              className="text-xs text-[#94a3b8] bg-[#0f1117]"
              rows={showRaw ? 20 : 8}
            />
          </div>

          {/* Right: extracted fields */}
          <div className="space-y-3">
            <FieldRow fieldKey="name" label="姓名">
              <Input
                value={currentData.name ?? ''}
                onChange={(e) => handleChange('name', e.target.value || null)}
              />
            </FieldRow>

            <div className="grid grid-cols-3 gap-2">
              <FieldRow fieldKey="phone" label="手机号">
                <Input
                  value={currentData.phone ?? ''}
                  onChange={(e) => handleChange('phone', e.target.value || null)}
                />
              </FieldRow>
              <FieldRow fieldKey="email" label="邮箱">
                <Input
                  value={currentData.email ?? ''}
                  onChange={(e) => handleChange('email', e.target.value || null)}
                />
              </FieldRow>
              <FieldRow fieldKey="gender" label="性别">
                <Input
                  value={currentData.gender ?? ''}
                  onChange={(e) => handleChange('gender', e.target.value || null)}
                  placeholder="男/女"
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <FieldRow fieldKey="birthDate" label="出生日期">
                <Input
                  value={currentData.birthDate ?? ''}
                  onChange={(e) => handleChange('birthDate', e.target.value || null)}
                  placeholder="1990-01"
                />
              </FieldRow>
              <FieldRow fieldKey="currentCompany" label="当前公司">
                <Input
                  value={currentData.currentCompany ?? ''}
                  onChange={(e) => handleChange('currentCompany', e.target.value || null)}
                />
              </FieldRow>
              <FieldRow fieldKey="currentPosition" label="当前职位">
                <Input
                  value={currentData.currentPosition ?? ''}
                  onChange={(e) => handleChange('currentPosition', e.target.value || null)}
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <FieldRow fieldKey="education" label="学历">
                <Input
                  value={currentData.education ?? ''}
                  onChange={(e) => handleChange('education', e.target.value || null)}
                />
              </FieldRow>
              <FieldRow fieldKey="yearsExp" label="工作年限">
                <Input
                  type="number"
                  value={currentData.yearsExp ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange('yearsExp', val ? parseInt(val, 10) : null);
                  }}
                />
              </FieldRow>
              <FieldRow fieldKey="expectedSalary" label="期望薪资">
                <Input
                  value={currentData.expectedSalary ?? ''}
                  onChange={(e) => handleChange('expectedSalary', e.target.value || null)}
                  placeholder="15-20k"
                />
              </FieldRow>
              <FieldRow fieldKey="expectedCity" label="期望城市">
                <Input
                  value={currentData.expectedCity ?? ''}
                  onChange={(e) => handleChange('expectedCity', e.target.value || null)}
                />
              </FieldRow>
            </div>

            <FieldRow fieldKey="selfIntroduction" label="自我介绍">
              <Textarea
                value={currentData.selfIntroduction ?? ''}
                onChange={(e) => handleChange('selfIntroduction', e.target.value || null)}
                className="text-xs bg-[#0f1117]"
                rows={3}
              />
            </FieldRow>

            <FieldRow fieldKey="skills" label="技能（逗号分隔）">
              <Input
                value={currentData.skills.join(', ')}
                onChange={(e) =>
                  handleChange(
                    'skills',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
              />
            </FieldRow>

            <FieldRow fieldKey="workExperiences" label="工作经历">
              {currentData.workExperiences.length === 0 ? (
                <p className="text-xs text-[#94a3b8]">未提取到工作经历</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {currentData.workExperiences.map((we, idx) => (
                    <div key={idx} className="rounded-md border border-[#2a2d35] bg-[#0f1117] p-2 text-xs space-y-1">
                      <div className="font-medium text-[#e2e8f0]">
                        {we.company} · {we.position}
                      </div>
                      <div className="text-[#94a3b8]">{we.duration}</div>
                      {we.description && (
                        <div className="text-[#94a3b8] line-clamp-2">{we.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </FieldRow>

            <FieldRow fieldKey="projectExperiences" label="项目经历">
              {currentData.projectExperiences.length === 0 ? (
                <p className="text-xs text-[#94a3b8]">未提取到项目经历</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {currentData.projectExperiences.map((pe, idx) => (
                    <div key={idx} className="rounded-md border border-[#2a2d35] bg-[#0f1117] p-2 text-xs space-y-1">
                      <div className="font-medium text-[#e2e8f0]">
                        {pe.name}
                        {pe.role && <span className="text-[#94a3b8]"> · {pe.role}</span>}
                      </div>
                      {pe.duration && <div className="text-[#94a3b8]">{pe.duration}</div>}
                      {pe.description && (
                        <div className="text-[#94a3b8] line-clamp-2">{pe.description}</div>
                      )}
                      {pe.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pe.technologies.map((tech, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-[#2a2d35] text-[#94a3b8] text-[10px]">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </FieldRow>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            <Check className="w-4 h-4 mr-1" />
            确认填充
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ParsePreviewDialog;
