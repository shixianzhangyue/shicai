import { useState, useEffect, useRef, useCallback } from 'react';
import type { Candidate, EducationLevel, CandidateSource, ParsedResume } from '@/types';
import { useCandidateStore } from '@/stores/candidateStore';
import { useTagStore } from '@/stores/tagStore';
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
import { Input } from '@/components/ui/input';
import TagPicker from '@/components/ui/TagPicker';
import ResumeParseButton from './ResumeParseButton';
import ParsePreviewDialog from './ParsePreviewDialog';

interface CandidateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCandidate?: Candidate | null;
}

const EDUCATION_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: '高中', label: '高中' },
  { value: '大专', label: '大专' },
  { value: '本科', label: '本科' },
  { value: '硕士', label: '硕士' },
  { value: '博士', label: '博士' },
];

const SOURCE_OPTIONS: { value: CandidateSource; label: string }[] = [
  { value: 'manual', label: '手动录入' },
  { value: 'import', label: '批量导入' },
  { value: 'referral', label: '内部推荐' },
];

function CandidateForm({ open, onOpenChange, editingCandidate }: CandidateFormProps) {
  const { tags, fetchTags } = useTagStore();
  const createCandidate = useCandidateStore((s) => s.createCandidate);
  const updateCandidate = useCandidateStore((s) => s.updateCandidate);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [currentPosition, setCurrentPosition] = useState('');
  const [education, setEducation] = useState<EducationLevel | ''>('');
  const [yearsExp, setYearsExp] = useState('');
  const [source, setSource] = useState<CandidateSource>('manual');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parsePreviewOpen, setParsePreviewOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResume | null>(null);
  const [originalFilePath, setOriginalFilePath] = useState<string | null>(null);
  const [pastingImage, setPastingImage] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editingCandidate;

  useEffect(() => {
    if (open) {
      fetchTags();
      if (editingCandidate) {
        setName(editingCandidate.name);
        setPhone(editingCandidate.phone ?? '');
        setEmail(editingCandidate.email ?? '');
        setCurrentCompany(editingCandidate.currentCompany ?? '');
        setCurrentPosition(editingCandidate.currentPosition ?? '');
        setEducation(editingCandidate.education ?? '');
        setYearsExp(editingCandidate.yearsExp?.toString() ?? '');
        setSource(editingCandidate.source);
        setSelectedTagIds(editingCandidate.tags ?? []);
      } else {
        setName('');
        setPhone('');
        setEmail('');
        setCurrentCompany('');
        setCurrentPosition('');
        setEducation('');
        setYearsExp('');
        setSource('manual');
        setSelectedTagIds([]);
      }
      setFormError('');
      // Reset parsed resume state when dialog opens
      if (!editingCandidate) {
        setParsedData(null);
        setOriginalFilePath(null);
      }
    }
  }, [open, editingCandidate, fetchTags]);

  const validate = (): boolean => {
    const n = name.trim();
    if (!n) {
      setFormError('姓名不能为空');
      return false;
    }
    if (n.length > 100) {
      setFormError('姓名不能超过 100 个字符');
      return false;
    }
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setFormError('邮箱格式不正确');
        return false;
      }
    }
    if (yearsExp.trim()) {
      const exp = parseInt(yearsExp, 10);
      if (isNaN(exp) || exp < 0 || exp > 50) {
        setFormError('工作年限应在 0-50 之间');
        return false;
      }
    }
    setFormError('');
    return true;
  };

  const handleParseSuccess = (result: ParsedResume, filePath?: string) => {
    setParsedData(result);
    if (filePath) setOriginalFilePath(filePath);
    setParsePreviewOpen(true);
  };

  const handleParseConfirm = (result: ParsedResume) => {
    if (result.name) setName(result.name);
    if (result.phone) setPhone(result.phone);
    if (result.email) setEmail(result.email);
    if (result.currentCompany) setCurrentCompany(result.currentCompany);
    if (result.currentPosition) setCurrentPosition(result.currentPosition);
    if (result.education) setEducation(result.education as EducationLevel);
    if (result.yearsExp !== null && result.yearsExp !== undefined) {
      setYearsExp(result.yearsExp.toString());
    }
  };

  const handleParseError = (error: string) => {
    setFormError(error);
  };

  // Clipboard image paste handler — Ctrl+V screenshot/clipboard image → OCR + LLM
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    // Only handle when dialog is open and not editing
    if (!open || isEditing) return;

    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (!imageItem) return;

    e.preventDefault();
    setPastingImage(true);
    setFormError('正在识别剪贴板图片...');

    try {
      const file = imageItem.getAsFile();
      if (!file) throw new Error('无法读取剪贴板图片');

      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:image/xxx;base64, prefix
          const base64 = result.split(',')[1];
          if (base64) resolve(base64);
          else reject(new Error('Base64 conversion failed'));
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const result = await api.resumeParser.parseImageBase64(base64);

      setParsedData(result);
      setOriginalFilePath(null); // No file path for pasted images
      setParsePreviewOpen(true);
      setFormError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`图片解析失败: ${msg}`);
    } finally {
      setPastingImage(false);
    }
  }, [open, isEditing]);

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        currentCompany: currentCompany.trim() || null,
        currentPosition: currentPosition.trim() || null,
        education: (education as EducationLevel) || null,
        yearsExp: yearsExp ? parseInt(yearsExp, 10) : null,
        source,
        tags: selectedTagIds,
      };
      if (isEditing && editingCandidate) {
        await updateCandidate(editingCandidate.id, payload);
      } else {
        // Auto-add to talent pool when creating from parsed resume
        const autoPool = parsedData !== null;
        const created = await createCandidate(payload, autoPool);

        // Save the original resume file and create a resumes table record
        if (created && originalFilePath) {
          try {
            await api.resumeParser.save(created.id, originalFilePath, parsedData ?? undefined);
          } catch (resumeErr) {
            // Non-fatal: candidate is already created, just log the resume save failure
            console.warn('Failed to save original resume file:', resumeErr);
          }
        }
      }
      onOpenChange(false);
      // Reset state
      setParsedData(null);
      setOriginalFilePath(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={dialogRef}
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onPaste={handlePaste}
        >
          <DialogHeader>
            <DialogTitle>{isEditing ? '编辑候选人' : '新建候选人'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? '修改候选人信息并保存'
                : '填写候选人基本信息，添加到人才库'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Smart parse section */}
            {!isEditing && (
              <div className="flex flex-col gap-2 pb-2 border-b border-[#2a2d35]">
                <div className="flex items-center gap-2">
                  <ResumeParseButton
                    onParseSuccess={handleParseSuccess}
                    onParseError={handleParseError}
                  />
                </div>
                {pastingImage && (
                  <p className="text-xs text-[#10b981] flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-[#10b981] border-t-transparent animate-spin" />
                    正在识别剪贴板图片...
                  </p>
                )}
                <p className="text-[10px] text-[#475569] -mt-1">支持 Ctrl+V 直接粘贴截图/剪贴板图片进行智能识别</p>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                姓名 <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="输入候选人姓名"
                maxLength={100}
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  手机号
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="输入手机号"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  邮箱
                </label>
                <Input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="输入邮箱地址"
                />
              </div>
            </div>

            {/* Current Company & Position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  当前公司
                </label>
                <Input
                  value={currentCompany}
                  onChange={(e) => setCurrentCompany(e.target.value)}
                  placeholder="输入当前公司"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  当前职位
                </label>
                <Input
                  value={currentPosition}
                  onChange={(e) => setCurrentPosition(e.target.value)}
                  placeholder="输入当前职位"
                />
              </div>
            </div>

            {/* Education & Years Exp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  学历
                </label>
                <select
                  value={education}
                  onChange={(e) => setEducation(e.target.value as EducationLevel | '')}
                  className="flex h-10 w-full rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
                >
                  <option value="">请选择</option>
                  {EDUCATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  工作年限
                </label>
                <Input
                  type="number"
                  value={yearsExp}
                  onChange={(e) => {
                    setYearsExp(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="例如 5"
                  min={0}
                  max={50}
                />
              </div>
            </div>

            {/* Source */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#e2e8f0]">
                来源 <span className="text-red-400">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as CandidateSource)}
                className="flex h-10 w-full rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
              >
                {SOURCE_OPTIONS.map((opt) => (
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

            {formError && (
              <p className="text-xs text-red-400">{formError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
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
              {submitting
                ? '保存中...'
                : isEditing
                  ? '保存修改'
                  : '创建候选人'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParsePreviewDialog
        open={parsePreviewOpen}
        onOpenChange={setParsePreviewOpen}
        data={parsedData}
        onConfirm={handleParseConfirm}
      />
    </>
  );
}

export default CandidateForm;
