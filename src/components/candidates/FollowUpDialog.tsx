import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, MessageSquare, Phone, MessageCircle, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { notify } from '@/lib/notify';

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  pipelineJobs: { jobId: string; jobTitle: string }[];
  onSuccess?: () => void;
}

const DEFAULT_TEMPLATES = [
  { name: '电话沟通', followType: 'phone' as const, content: '已与候选人电话沟通，初步了解情况。' },
  { name: '微信沟通', followType: 'wechat' as const, content: '已通过微信联系候选人。' },
  { name: '面试反馈', followType: 'meeting' as const, content: '已完成面试，反馈如下：' },
];

const FOLLOW_TYPE_OPTIONS = [
  { value: 'phone', label: '电话', icon: Phone },
  { value: 'wechat', label: '微信', icon: MessageCircle },
  { value: 'meeting', label: '面谈', icon: Users },
  { value: 'email', label: '邮件', icon: MessageSquare },
  { value: 'other', label: '其他', icon: MessageSquare },
];

export function FollowUpDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  pipelineJobs,
  onSuccess,
}: FollowUpDialogProps) {
  const showToast = (msg: string, type: 'success' | 'error') => notify[type](msg);
  const [followType, setFollowType] = useState('phone');
  const [content, setContent] = useState('');
  const [relatedJobId, setRelatedJobId] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-select job when there's only one
  useEffect(() => {
    if (open) {
      if (pipelineJobs.length === 1) {
        setRelatedJobId(pipelineJobs[0].jobId);
      } else {
        setRelatedJobId('');
      }
      setFollowType('phone');
      setContent('');
    }
  }, [open, pipelineJobs]);

  const handleTemplateClick = (template: typeof DEFAULT_TEMPLATES[number]) => {
    setFollowType(template.followType);
    setContent(template.content);
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await api.followUps.create({
        candidateId,
        content: content.trim(),
        followType,
        relatedJobId: relatedJobId || null,
      });
      showToast('跟进记录已添加', 'success');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      notify.error('Failed to create follow-up');
      showToast('添加跟进记录失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#8b5cf6]" />
            新增跟进记录
          </DialogTitle>
          <DialogDescription>
            为 <span className="text-[#e2e8f0] font-medium">{candidateName}</span> 添加一条跟进记录
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template buttons */}
          <div>
            <Label className="text-xs text-[#64748b] mb-2 block">快捷模板</Label>
            <div className="flex gap-2">
              {DEFAULT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => handleTemplateClick(tpl)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#2a2d35] bg-[#1a1d24] text-[#94a3b8] hover:bg-[#8b5cf6]/10 hover:text-[#8b5cf6] hover:border-[#8b5cf6]/30 transition-colors"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Follow type */}
          <div>
            <Label className="text-xs text-[#64748b] mb-2 block">跟进类型</Label>
            <select
              value={followType}
              onChange={(e) => setFollowType(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0] focus:outline-none focus:border-[#8b5cf6]/50"
            >
              {FOLLOW_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <Label className="text-xs text-[#64748b] mb-2 block">跟进内容</Label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入跟进内容..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0] placeholder:text-[#64748b] resize-none focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          {/* Related job - only show when multiple jobs */}
          {pipelineJobs.length > 1 && (
            <div>
              <Label className="text-xs text-[#64748b] mb-2 block">关联职位</Label>
              <select
                value={relatedJobId}
                onChange={(e) => setRelatedJobId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0] focus:outline-none focus:border-[#8b5cf6]/50"
              >
                <option value="">不关联职位</option>
                {pipelineJobs.map((j) => (
                  <option key={j.jobId} value={j.jobId}>{j.jobTitle}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            {loading ? '提交中...' : '提交跟进'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
