import { useState, useEffect, useRef } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import type { ResumeFileType } from '@/types';
import { FileText, ExternalLink, AlertCircle, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { notify } from '@/lib/notify';

interface ResumePreviewProps {
  filePath: string | null;
  fileName: string | null;
  fileType: ResumeFileType | null;
}

export function ResumePreview({ filePath, fileName, fileType }: ResumePreviewProps) {
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  // Use ref to track current blob URL for reliable cleanup
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setLoadError(false);
    setLoading(true);
    setZoom(100);
    setDataUrl(null);

    // Cleanup previous blob URL before creating a new one
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!filePath) {
      setLoading(false);
      return;
    }

    // Read file as binary and convert to data URL
    const loadFile = async () => {
      try {
        const bytes = await readFile(filePath);
        const blob = new Blob([bytes], {
          type: fileType === 'pdf' ? 'application/pdf' :
                fileType === 'png' ? 'image/png' :
                fileType === 'jpg' || fileType === 'jpeg' ? 'image/jpeg' :
                fileType === 'bmp' ? 'image/bmp' : 'application/octet-stream'
        });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setDataUrl(url);
        setLoading(false);
      } catch (err) {
        notify.error('Failed to read file');
        setLoadError(true);
        setLoading(false);
      }
    };

    loadFile();

    return () => {
      // Cleanup: revoke the blob URL using ref (always has the latest value)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [filePath, fileType]);

  const handleOpenInSystem = async () => {
    if (!filePath) return;
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(filePath);
    } catch (err) {
      notify.error('Failed to open file');
    }
  };

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <FileText className="w-12 h-12 mb-4 text-[#2a2d35]" />
        <p className="text-sm text-[#94a3b8]">暂无简历文件</p>
        <p className="text-xs text-[#64748b] mt-1">候选人未上传简历</p>
      </div>
    );
  }

  const isImage = fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png' || fileType === 'bmp';
  const isPdf = fileType === 'pdf';
  const isPreviewable = isPdf || isImage;

  if (isPreviewable && !loadError && dataUrl) {
    return (
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2d35] bg-[#0f1117] shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-[#64748b]" />
            <span className="text-xs text-[#94a3b8] truncate max-w-[250px]">{fileName}</span>
          </div>
          <div className="flex items-center gap-1">
            {isImage && (
              <>
                <button
                  onClick={() => setZoom((z) => Math.max(25, z - 25))}
                  disabled={zoom <= 25}
                  className="p-1.5 rounded text-xs text-[#94a3b8] hover:bg-[#2a2d35] disabled:opacity-30 transition-colors"
                  title="缩小"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#64748b] min-w-[36px] text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 25))}
                  disabled={zoom >= 200}
                  className="p-1.5 rounded text-xs text-[#94a3b8] hover:bg-[#2a2d35] disabled:opacity-30 transition-colors"
                  title="放大"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-[#2a2d35] mx-1" />
              </>
            )}
            <button
              onClick={() => setZoom(100)}
              className="px-2 py-1 rounded text-[10px] text-[#94a3b8] hover:bg-[#2a2d35] transition-colors"
            >
              重置
            </button>
            <div className="w-px h-4 bg-[#2a2d35] mx-1" />
            <button
              onClick={handleOpenInSystem}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              系统打开
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-[#0f1117] flex items-center justify-center p-4">
          {isPdf ? (
            <iframe
              src={dataUrl}
              className="w-full h-full min-h-[600px] rounded-lg border border-[#2a2d35]"
              title={fileName || 'PDF Preview'}
            />
          ) : isImage ? (
            <div className="overflow-auto max-w-full max-h-full">
              <img
                src={dataUrl}
                alt={fileName || 'Resume'}
                className="max-w-none rounded-lg transition-transform duration-200"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6] mb-3" />
        <p className="text-sm text-[#94a3b8]">加载简历文件中...</p>
      </div>
    );
  }

  // Fallback: load error or non-previewable
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {loadError ? (
        <>
          <AlertCircle className="w-12 h-12 mb-4 text-amber-400" />
          <h3 className="text-sm font-medium text-[#e2e8f0] mb-2">预览不可用</h3>
          <p className="text-xs text-[#94a3b8] mb-1">文件加载失败，请尝试用系统程序打开</p>
        </>
      ) : (
        <>
          <FileText className="w-12 h-12 mb-4 text-[#3b82f6]" />
          <h3 className="text-sm font-medium text-[#e2e8f0] mb-2">
            {fileType === 'docx' ? 'Word 文档' : '简历文件'}
          </h3>
          <p className="text-xs text-[#94a3b8] mb-6">{fileName}</p>
        </>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleOpenInSystem}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          在系统阅读器中打开
        </button>
      </div>
    </div>
  );
}
