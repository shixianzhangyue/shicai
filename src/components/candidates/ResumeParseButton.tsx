import { useState, useCallback, useRef } from 'react';
import type { ParsedResume, ParseStage } from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { open } from '@tauri-apps/plugin-dialog';
import { FileText, Clipboard } from 'lucide-react';

interface ResumeParseButtonProps {
  onParseSuccess: (result: ParsedResume) => void;
  onParseError?: (error: string) => void;
}

function ResumeParseButton({ onParseSuccess, onParseError }: ResumeParseButtonProps) {
  const [stage, setStage] = useState<ParseStage>('idle');
  const isParsingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [inputText, setInputText] = useState('');

  const stageLabels: Record<ParseStage, string> = {
    idle: '智能解析简历',
    selecting: '选择文件中...',
    extracting: '提取文本中...',
    parsing: 'AI 解析中...',
    preview: '解析完成',
    filled: '已填充',
    error: '解析失败',
  };

  const handleFileParse = useCallback(() => {
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
            { name: '简历', extensions: ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'bmp'] },
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

  const handleTextParse = useCallback(async () => {
    if (!inputText.trim()) {
      if (onParseError) onParseError('请输入简历文本');
      return;
    }

    isParsingRef.current = true;
    setStage('parsing');
    setShowTextInput(false);

    try {
      const result = await api.resumeParser.parseText(inputText);
      setStage('preview');
      onParseSuccess(result);
      setStage('filled');
      setInputText('');

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
  }, [inputText, onParseSuccess, onParseError]);

  const isBusy = stage !== 'idle' && stage !== 'error' && stage !== 'filled';

  return (
    <>
      <div className="flex gap-2">
        <Button
          onClick={handleFileParse}
          disabled={isBusy}
          variant="ghost"
          className="inline-flex items-center gap-2 text-[#e2e8f0] hover:bg-[#2a2d35]"
        >
          <FileText className="w-4 h-4" />
          <span>{stageLabels[stage]}</span>
          {isBusy && (
            <span className="inline-block w-3 h-3 rounded-full border-2 border-[#2a2d35] border-t-[#3b82f6] animate-spin" />
          )}
        </Button>
        <Button
          onClick={() => setShowTextInput(true)}
          disabled={isBusy}
          variant="ghost"
          className="inline-flex items-center gap-2 text-[#e2e8f0] hover:bg-[#2a2d35]"
        >
          <Clipboard className="w-4 h-4" />
          <span>粘贴文本解析</span>
        </Button>
      </div>

      <Dialog open={showTextInput} onOpenChange={setShowTextInput}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>粘贴简历文本</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="请将简历文本粘贴到这里..."
              className="min-h-[300px] bg-[#0f1117]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowTextInput(false);
                setInputText('');
              }}
              className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
            >
              取消
            </Button>
            <Button
              onClick={handleTextParse}
              disabled={!inputText.trim()}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              开始解析
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ResumeParseButton;
