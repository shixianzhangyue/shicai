import type { Job } from '@/types';
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
import { AlertTriangle } from 'lucide-react';

interface DeleteJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  onConfirm: () => void;
}

function DeleteJobDialog({ open, onOpenChange, job, onConfirm }: DeleteJobDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            确认删除职位？
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            职位「{job?.title ?? ''}」将被移至回收站（软删除）。关联的候选人
            pipeline 数据不会丢失，但不再显示在当前列表中。此操作会被记录到审计日志。
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
            onClick={onConfirm}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteJobDialog;
