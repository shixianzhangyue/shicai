import { useState, useCallback, useRef } from 'react';
import type { ParsedResume, ParseStage } from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { open } from '@tauri-apps/plugin-dialog';

interface ResumeParseButtonProps {
  onParseSuccess: (result: ParsedResume) => void;
  onParseError?: (error: string) => void;
}

function ResumeParseButton({ onParseSuccess, onParseError }: ResumeParseButtonProps) {
  const [stage, setStage] = useState<ParseStage>('idle');
  const isParsingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stageLabels: Record<ParseStage, string> = {
    idle: '智能解析简历',
    selecting: '选择文件中...',
    extracting: '提取文本中...',
    parsing: 'AI 解析中...',
    preview: '解析完成',
    filled: '已填充',
    error: '解析失败',
  };

  const handleClick = useCallback(() => {
    if (isParsingRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      isParsingRef.current = true;
      setStage('selecting');

      try {
        const filePath = await open({
          multiple: false,
          directory: false,
          filters: [
            { name: '简历', extensions: ['pdf', 'docx', 'txt'] },
          ],
        });

        if (!filePath || Array.isArray(filePath)) {
          setStage('idle');
          isParsingRef.current = false;
          return;
        }

        setStage('extracting');
        // Small delay to allow UI update
        await new Promise((r) => setTimeout(r, 100));

        setStage('parsing');
        const result = await api.resumeParser.parse(filePath);

        setStage('preview');
        onParseSuccess(result);
        setStage('filled');

        // Reset after a while
        setTimeout(() => {
          setStage('idle');
          isParsingRef.current = false;
        }, 2000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStage('error');
        if (onParseError) onParseError(msg);
        isParsingRef.current = false;
        setTimeout(() => setStage('idle'), 3000);
      }
    }, 300);
  }, [onParseSuccess, onParseError]);

  const isBusy = stage !== 'idle' && stage !== 'error' && stage !== 'filled';

  return (
    <Button
      onClick={handleClick}
      disabled={isBusy}
      variant="ghost"
      className="inline-flex items-center gap-2 text-[#e2e8f0] hover:bg-[#2a2d35]"
    >
      <span>📄</span>
      <span>{stageLabels[stage]}</span>
      {isBusy && (
        <span className="inline-block w-3 h-3 rounded-full border-2 border-[#2a2d35] border-t-[#3b82f6] animate-spin" />
      )}
    </Button>
  );
}

export default ResumeParseButton;
