import { useState, useEffect } from 'react';
import type { Candidate, EducationLevel, CandidateSource, ParsedResume } from '@/types';
import { useCandidateStore } from '@/stores/candidateStore';
import { useTagStore } from '@/stores/tagStore';
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

  const handleParseSuccess = (result: ParsedResume) => {
    setParsedData(result);
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
        await createCandidate(payload, autoPool);
      }
      onOpenChange(false);
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <div className="flex items-center gap-2 pb-2 border-b border-[#2a2d35]">
                <ResumeParseButton
                  onParseSuccess={handleParseSuccess}
                  onParseError={handleParseError}
                />
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
