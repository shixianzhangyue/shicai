import { useState } from 'react';
import type { ParsedResume } from '@/types';
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

interface ParsePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ParsedResume | null;
  onConfirm: (result: ParsedResume) => void;
}

function ParsePreviewDialog({ open, onOpenChange, data, onConfirm }: ParsePreviewDialogProps) {
  const [edited, setEdited] = useState<ParsedResume | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // When data changes, reset edited state
  const currentData = edited ?? data;

  const handleChange = (field: keyof ParsedResume, value: unknown) => {
    if (!currentData) return;
    setEdited({ ...currentData, [field]: value } as ParsedResume);
  };

  const handleConfirm = () => {
    if (currentData) {
      onConfirm(currentData);
      setEdited(null);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setEdited(null);
    onOpenChange(false);
  };

  if (!currentData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>解析结果预览</DialogTitle>
          <DialogDescription>
            请核对并编辑提取的信息，确认后填充到表单中
          </DialogDescription>
        </DialogHeader>

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
            <div className="space-y-1">
              <Label>姓名</Label>
              <Input
                value={currentData.name ?? ''}
                onChange={(e) => handleChange('name', e.target.value || null)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>手机号</Label>
                <Input
                  value={currentData.phone ?? ''}
                  onChange={(e) => handleChange('phone', e.target.value || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>邮箱</Label>
                <Input
                  value={currentData.email ?? ''}
                  onChange={(e) => handleChange('email', e.target.value || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>性别</Label>
                <Input
                  value={currentData.gender ?? ''}
                  onChange={(e) => handleChange('gender', e.target.value || null)}
                  placeholder="男/女"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>出生日期</Label>
                <Input
                  value={currentData.birthDate ?? ''}
                  onChange={(e) => handleChange('birthDate', e.target.value || null)}
                  placeholder="1990-01"
                />
              </div>
              <div className="space-y-1">
                <Label>当前公司</Label>
                <Input
                  value={currentData.currentCompany ?? ''}
                  onChange={(e) => handleChange('currentCompany', e.target.value || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>当前职位</Label>
                <Input
                  value={currentData.currentPosition ?? ''}
                  onChange={(e) => handleChange('currentPosition', e.target.value || null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label>学历</Label>
                <Input
                  value={currentData.education ?? ''}
                  onChange={(e) => handleChange('education', e.target.value || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>工作年限</Label>
                <Input
                  type="number"
                  value={currentData.yearsExp ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange('yearsExp', val ? parseInt(val, 10) : null);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>期望薪资</Label>
                <Input
                  value={currentData.expectedSalary ?? ''}
                  onChange={(e) => handleChange('expectedSalary', e.target.value || null)}
                  placeholder="15-20k"
                />
              </div>
              <div className="space-y-1">
                <Label>期望城市</Label>
                <Input
                  value={currentData.expectedCity ?? ''}
                  onChange={(e) => handleChange('expectedCity', e.target.value || null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>自我介绍</Label>
              <Textarea
                value={currentData.selfIntroduction ?? ''}
                onChange={(e) => handleChange('selfIntroduction', e.target.value || null)}
                className="text-xs bg-[#0f1117]"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>技能（逗号分隔）</Label>
              <Input
                value={currentData.skills.join(', ')}
                onChange={(e) =>
                  handleChange(
                    'skills',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
              />
            </div>

            <div className="space-y-1">
              <Label>工作经历</Label>
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
            </div>

            <div className="space-y-1">
              <Label>项目经历</Label>
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
            </div>
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
            确认填充
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ParsePreviewDialog;
