import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ResumeFileType } from '@/types';
import { FileText, ExternalLink, Download, AlertCircle, Loader2 } from 'lucide-react';

interface ResumePreviewProps {
  filePath: string | null;
  fileName: string | null;
  fileType: ResumeFileType | null;
}

export function ResumePreview({ filePath, fileName, fileType }: ResumePreviewProps) {
  const [pdfError, setPdfError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  // Check if react-pdf is available
  const hasReactPdf = typeof window !== 'undefined';

  useEffect(() => {
    setPdfError(false);
    setLoading(true);
    setPageNumber(1);
    setNumPages(0);
  }, [filePath]);

  const handleOpenInSystem = async () => {
    if (!filePath) return;
    try {
      const { openPath } = await import('@tauri-apps/plugin-shell');
      await openPath(filePath);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handlePdfError = (error: Error) => {
    console.error('PDF render error:', error);
    // Check for blob: URL related errors (WebView compatibility issue)
    const msg = error.message || String(error);
    if (msg.includes('blob') || msg.includes('URL') || msg.includes('worker')) {
      setPdfError(true);
    } else {
      setPdfError(true);
    }
    setLoading(false);
  };

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="w-12 h-12 mb-4 text-[#2a2d35]" />
        <p className="text-sm text-[#94a3b8]">暂无简历文件</p>
        <p className="text-xs text-[#64748b] mt-1">候选人未上传简历</p>
      </div>
    );
  }

  // PDF type with react-pdf
  if (fileType === 'pdf' && !pdfError) {
    return (
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2d35] bg-[#0f1117]">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#94a3b8] truncate max-w-[200px]">{fileName}</span>
            {numPages > 0 && (
              <span className="text-xs text-[#64748b]">
                {pageNumber} / {numPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="px-2 py-1 rounded text-xs text-[#94a3b8] hover:bg-[#2a2d35] disabled:opacity-30 transition-colors"
            >
              上一页
            </button>
            <button
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="px-2 py-1 rounded text-xs text-[#94a3b8] hover:bg-[#2a2d35] disabled:opacity-30 transition-colors"
            >
              下一页
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

        {/* PDF Viewer - using iframe for WebView compatibility */}
        <div className="flex-1 overflow-auto bg-[#0f1117] flex items-center justify-center p-4">
          {loading && (
            <div className="flex items-center gap-2 text-[#94a3b8]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          )}
          {/* Use object tag for PDF rendering (more compatible with WebView) */}
          <object
            data={`tauri://localhost/${filePath}`}
            type="application/pdf"
            className="w-full h-full min-h-[500px] rounded-lg"
            onLoad={() => setLoading(false)}
            onError={() => handlePdfError(new Error('PDF load failed'))}
          >
            {/* Fallback when object fails */}
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-10 h-10 mb-3 text-amber-400" />
              <p className="text-sm text-[#94a3b8]">无法在当前窗口预览 PDF</p>
              <button
                onClick={handleOpenInSystem}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                在系统阅读器中打开
              </button>
            </div>
          </object>
        </div>
      </div>
    );
  }

  // PDF error fallback or non-PDF types
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {pdfError ? (
        <>
          <AlertCircle className="w-12 h-12 mb-4 text-amber-400" />
          <h3 className="text-sm font-medium text-[#e2e8f0] mb-2">PDF 预览不可用</h3>
          <p className="text-xs text-[#94a3b8] mb-1">当前环境不支持 PDF 内嵌预览</p>
          <p className="text-xs text-[#64748b] mb-6">可能是 WebView 兼容性问题</p>
        </>
      ) : (
        <>
          <FileText className="w-12 h-12 mb-4 text-[#3b82f6]" />
          <h3 className="text-sm font-medium text-[#e2e8f0] mb-2">
            {fileType === 'docx' ? 'Word 文档' : fileType === 'jpg' || fileType === 'png' ? '图片文件' : '简历文件'}
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
