import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { notify } from '@/lib/notify';
import type { ImportRow, ImportResult, BatchParseItem } from '@/types';
import { read, utils } from 'xlsx';
import { X, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, Loader2, ChevronRight } from 'lucide-react';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELD_MAP: { key: keyof ImportRow; label: string; required: boolean }[] = [
  { key: 'name', label: '姓名', required: true },
  { key: 'phone', label: '手机号', required: false },
  { key: 'email', label: '邮箱', required: false },
  { key: 'currentCompany', label: '当前公司', required: false },
  { key: 'currentPosition', label: '当前职位', required: false },
  { key: 'education', label: '学历', required: false },
  { key: 'yearsExp', label: '工作年限', required: false },
  { key: 'source', label: '来源', required: false },
];

const EDUCATION_OPTIONS = ['高中', '大专', '本科', '硕士', '博士'];

type ImportMode = 'excel' | 'resume';
type StepType = 'mode_select' | 'upload' | 'parsing' | 'preview' | 'result';

export function ImportDialog({ open, onClose, onSuccess }: ImportDialogProps) {
  const [step, setStep] = useState<StepType>('mode_select');
  const [mode, setMode] = useState<ImportMode>('excel');

  // Excel import state
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  // Resume batch import state
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]); // Tauri file paths
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [parseResults, setParseResults] = useState<BatchParseItem[]>([]);
  const [currentParsingIdx, setCurrentParsingIdx] = useState<number>(-1);
  const [resumeResult, setResumeResult] = useState<{ created: number; skipped: number; failed: number; errors: string[] } | null>(null);

  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Mode Selection ────────────────────────────────
  const handleSelectMode = (m: ImportMode) => {
    setMode(m);
    setStep('upload');
  };

  const resetToModes = useCallback(() => {
    setStep('mode_select');
    setMode('excel');
    setFile(null);
    setRows([]);
    setHeaders([]);
    setFieldMapping({});
    setResult(null);
    setSelectedFiles([]);
    setSelectedFileNames([]);
    setParseResults([]);
    setCurrentParsingIdx(-1);
    setResumeResult(null);
    setLoading(false);
  }, []);

  // ─── Excel File Handling ───────────────────────────
  const handleExcelFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

      if (jsonData.length < 2) {
        alert('文件数据不足，至少需要包含表头和一行数据');
        setLoading(false);
        return;
      }

      const fileHeaders = jsonData[0].map((h) => String(h).trim());
      const dataRows = jsonData.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== ''));

      // Auto-detect field mapping
      const autoMapping: Record<string, string> = {};
      fileHeaders.forEach((header, idx) => {
        const lower = header.toLowerCase();
        if (lower.includes('姓名') || lower === 'name') autoMapping[String(idx)] = 'name';
        else if (lower.includes('手机') || lower.includes('电话') || lower === 'phone') autoMapping[String(idx)] = 'phone';
        else if (lower.includes('邮箱') || lower.includes('邮件') || lower === 'email') autoMapping[String(idx)] = 'email';
        else if (lower.includes('公司') || lower === 'company') autoMapping[String(idx)] = 'currentCompany';
        else if (lower.includes('职位') || lower.includes('岗位') || lower === 'position') autoMapping[String(idx)] = 'currentPosition';
        else if (lower.includes('学历') || lower.includes('学位') || lower === 'education') autoMapping[String(idx)] = 'education';
        else if (lower.includes('年限') || lower.includes('经验') || lower.includes('年') || lower === 'yearsexp') autoMapping[String(idx)] = 'yearsExp';
        else if (lower.includes('来源') || lower === 'source') autoMapping[String(idx)] = 'source';
      });

      setHeaders(fileHeaders);
      setFieldMapping(autoMapping);

      const parsedRows: ImportRow[] = dataRows.map((row) => {
        const obj: Record<string, unknown> = {};
        fileHeaders.forEach((_, idx) => {
          const mappedField = autoMapping[String(idx)];
          if (mappedField) {
            const val = row[idx];
            if (mappedField === 'yearsExp') {
              const num = typeof val === 'number' ? val : parseInt(String(val));
              obj[mappedField] = isNaN(num) ? undefined : num;
            } else {
              obj[mappedField] = val !== undefined ? String(val) : undefined;
            }
          }
        });
        return obj as ImportRow;
      });

      setRows(parsedRows);
      setStep('preview');
    } catch (err) {
      notify.error('Failed to parse file');
      alert('文件解析失败，请检查文件格式');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExcelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
      handleExcelFileSelect(droppedFile);
    }
  };

  const handleExcelImport = async () => {
    setLoading(true);
    const importResult: ImportResult = { success: 0, skipped: 0, failed: 0, errors: [] };

    for (const row of rows) {
      try {
        if (!row.name || row.name.trim() === '') {
          importResult.failed++;
          importResult.errors.push(`跳过空姓名行`);
          continue;
        }
        if (row.phone) {
          try {
            const dups = await api.talentPool.checkDuplicate(row.phone, row.email);
            if (dups.length > 0) {
              importResult.skipped++;
              importResult.errors.push(`「${row.name}」已存在（手机号/邮箱重复）`);
              continue;
            }
          } catch {
            // Ignore check error, proceed with import
          }
        }
        let education = row.education;
        if (education) {
          const matched = EDUCATION_OPTIONS.find((e) => education!.includes(e));
          if (matched) education = matched;
        }

        await api.candidates.create({
          name: row.name.trim(),
          phone: row.phone || null,
          email: row.email || null,
          currentCompany: row.currentCompany || null,
          currentPosition: row.currentPosition || null,
          education: (education as '高中' | '大专' | '本科' | '硕士' | '博士' | null) || null,
          yearsExp: row.yearsExp ?? null,
          source: (row.source as 'manual' | 'import' | 'referral') || 'import',
          tags: [],
        });
        importResult.success++;
      } catch (err) {
        importResult.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        importResult.errors.push(`「${row.name || '?'}」导入失败: ${msg}`);
      }
    }

    setResult(importResult);
    setStep('result');
    setLoading(false);
    if (importResult.success > 0) {
      onSuccess();
    }
  };

  // ─── Resume Batch File Handling ─────────────────────
  const doBatchParse = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setLoading(true);
    setParseResults([]);

    try {
      const results = await api.resumeParser.batchParse(paths);
      setParseResults(results);

      // Auto-create candidates from successful parses
      let created = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < results.length; i++) {
        setCurrentParsingIdx(i);
        const item = results[i];

        if (!item.success || !item.data) {
          failed++;
          errors.push(`「${item.fileName}」: ${item.error ?? '解析失败'}`);
          continue;
        }

        const parsed = item.data;

        // Check duplicate
        if (parsed.phone) {
          try {
            const dups = await api.talentPool.checkDuplicate(parsed.phone, parsed.email ?? undefined);
            if (dups.length > 0) {
              skipped++;
              errors.push(`「${parsed.name || item.fileName}」已存在（手机号/邮箱重复）`);
              continue;
            }
          } catch { /* proceed */ }
        }

        // Create candidate
        let education = parsed.education;
        if (education) {
          const matched = EDUCATION_OPTIONS.find(e => education!.includes(e));
          if (matched) education = matched;
        }

        try {
          const candidate = await api.candidates.create({
            name: (parsed.name?.trim()) || item.fileName.replace(/\.[^.]+$/, ''),
            phone: parsed.phone || null,
            email: parsed.email || null,
            currentCompany: parsed.currentCompany || null,
            currentPosition: parsed.currentPosition || null,
            education: (education as '高中' | '大专' | '本科' | '硕士' | '博士' | null) || null,
            yearsExp: parsed.yearsExp ?? null,
            source: 'import',
            tags: [],
          }, true); // auto add to talent pool

          // Save original resume file
          try {
            await api.resumeParser.save(candidate.id, item.filePath, parsed);
          } catch {
            /* non-fatal */
          }

          created++;
        } catch (err) {
          failed++;
          errors.push(`「${parsed.name || item.fileName}」创建失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      setResumeResult({ created, skipped, failed, errors });
      setStep('result');
      if (created > 0) onSuccess();
    } catch (err) {
      notify.error(`批量解析失败: ${err instanceof Error ? err.message : String(err)}`);
      setStep('upload');
    } finally {
      setLoading(false);
      setCurrentParsingIdx(-1);
    }
  }, [onSuccess]);

  const handleResumeFileSelect = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePaths = await open({
        multiple: true,
        directory: false,
        filters: [
          { name: '简历文件', extensions: ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'bmp'] },
        ],
      }) as string | string[];

      if (!filePaths || (Array.isArray(filePaths) && filePaths.length === 0)) return;

      const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
      const names = paths.map(p => p.split(/[/\\]/).pop() || 'unknown');

      setSelectedFiles(paths);
      setSelectedFileNames(names);
      setStep('parsing');

      // Automatically start batch parsing immediately
      await doBatchParse(paths);
    } catch (err) {
      console.error('File selection cancelled or failed:', err);
    }
  }, [doBatchParse]);

  const handleResumeDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // For resume files in browser drag-drop, we need to save them first via Tauri FS API
    // Fall back to file picker for now — drag-drop for resume files requires temp file handling
    notify.info('简历文件请点击选择或使用文件对话框多选');
  };

  // ─── Render ─────────────────────────────────────────
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl mx-4 rounded-xl border border-[#2a2d35] bg-[#1a1d24] shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d35]">
          <div className="flex items-center gap-2">
            {step === 'mode_select' && <Upload className="w-5 h-5 text-[#3b82f6]" />}
            {(mode === 'excel' && step !== 'mode_select') && <FileSpreadsheet className="w-5 h-5 text-[#3b82f6]" />}
            {(mode === 'resume' && step !== 'mode_select') && <FileText className="w-5 h-5 text-[#3b82f6]" />}
            <span className="text-sm font-medium text-[#e2e8f0]">
              {step === 'mode_select' ? '批量导入候选人' : mode === 'excel' ? 'Excel 批量导入' : '简历文件批量导入'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#2a2d35] text-[#94a3b8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step: Mode Select ── */}
          {step === 'mode_select' && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <button
                onClick={() => handleSelectMode('excel')}
                className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-[#2a2d35] hover:border-[#3b82f6]/50 bg-[#0f1117] transition-all duration-200 hover:bg-[#3b82f6]/5"
              >
                <div className="w-14 h-14 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center group-hover:bg-[#3b82f6]/20 transition-colors">
                  <FileSpreadsheet className="w-7 h-7 text-[#3b82f6]" />
                </div>
                <span className="text-sm font-medium text-[#e2e8f0]">Excel / CSV 表格</span>
                <span className="text-xs text-[#64748b] text-center">从表格批量导入候选人信息</span>
                <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={() => handleSelectMode('resume')}
                className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-[#2a2d35] hover:border-[#10b981]/50 bg-[#0f1117] transition-all duration-200 hover:bg-[#10b981]/5"
              >
                <div className="w-14 h-14 rounded-xl bg-[#10b981]/10 flex items-center justify-center group-hover:bg-[#10b981]/20 transition-colors">
                  <FileText className="w-7 h-7 text-[#10b981]" />
                </div>
                <span className="text-sm font-medium text-[#e2e8f0]">简历文件</span>
                <span className="text-xs text-[#64748b] text-center">PDF/DOCX/图片等简历批量解析入库</span>
                <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-[#10b981] group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          )}

          {/* ── Step: Excel Upload ── */}
          {step === 'upload' && mode === 'excel' && (
            <div
              onDrop={handleExcelDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[#2a2d35] rounded-xl p-10 text-center hover:border-[#3b82f6]/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-4 text-[#3b82f6]" />
              <p className="text-sm text-[#e2e8f0] mb-2">点击或拖拽上传 Excel 文件</p>
              <p className="text-xs text-[#64748b]">支持 .xlsx, .xls, .csv 格式</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleExcelFileSelect(f);
                }}
              />
            </div>
          )}

          {/* ── Step: Resume File Upload ── */}
          {step === 'upload' && mode === 'resume' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleResumeDrop}
              className="border-2 border-dashed border-[#2a2d35] rounded-xl p-10 text-center hover:border-[#10b981]/50 transition-colors cursor-pointer"
              onClick={handleResumeFileSelect}
            >
              <FileText className="w-10 h-10 mx-auto mb-4 text-[#10b981]" />
              <p className="text-sm text-[#e2e8f0] mb-2">点击选择简历文件（可多选）</p>
              <p className="text-xs text-[#64748b]">支持 PDF / DOCX / TXT / JPG / PNG 等格式</p>
              <p className="text-xs text-[#475569] mt-2">选中后自动进行 AI 解析并创建候选人</p>
            </div>
          )}

          {/* ── Step: Parsing Progress ── */}
          {step === 'parsing' && mode === 'resume' && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#10b981]" />
                <p className="text-sm font-medium text-[#e2e8f0]">正在解析 {selectedFileNames.length} 份简历...</p>
                <p className="text-xs text-[#64748b] mt-1">
                  {currentParsingIdx >= 0 && currentParsingIdx < selectedFileNames.length
                    ? `正在处理: ${selectedFileNames[currentParsingIdx]}`
                    : '准备中...'}
                </p>
              </div>

              {/* File list preview */}
              <div className="rounded-lg border border-[#2a2d35] bg-[#0f1117] p-3 max-h-[300px] overflow-y-auto">
                {selectedFileNames.map((name, i) => {
                  const isDone = i < parseResults.length;
                  const result = parseResults[i];
                  return (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-md ${i === currentParsingIdx ? 'bg-[#10b981]/10' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {!isDone && i > currentParsingIdx ? (
                          <div className="w-4 h-4 rounded-full border border-[#475569]" />
                        ) : isDone && result?.success ? (
                          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        ) : isDone && !result?.success ? (
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-[#10b981] shrink-0" />
                        )}
                        <span className="text-xs text-[#e2e8f0] truncate">{name}</span>
                      </div>
                      {isDone && result && (
                        <span className={`text-xs shrink-0 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                          {result.success ? (result.data?.name || '成功') : '失败'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Parse progress summary during creation phase */}
              {parseResults.length > 0 && parseResults.length === selectedFileNames.filter((_, i) => i <= currentParsingIdx || true).length && !resumeResult && (
                <div className="text-center text-xs text-[#94a3b8]">
                  解析完成，正在创建候选人...
                </div>
              )}
            </div>
          )}

          {/* ── Step: Excel Preview & Mapping ── */}
          {step === 'preview' && mode === 'excel' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#94a3b8]">
                  共 <span className="text-[#e2e8f0] font-medium">{rows.length}</span> 条数据
                  {file && <span className="ml-2 text-xs text-[#64748b]">({file.name})</span>}
                </p>
                <button onClick={resetToModes} className="text-xs text-[#3b82f6] hover:underline">
                  重新选择模式
                </button>
              </div>

              <div className="rounded-lg border border-[#2a2d35] bg-[#0f1117] p-3">
                <p className="text-xs text-[#94a3b8] mb-2">字段映射（已自动识别）</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FIELD_MAP.map((field) => {
                    const mappedCol = Object.entries(fieldMapping).find(([, v]) => v === field.key);
                    return (
                      <div key={field.key} className="flex items-center gap-1.5 text-xs">
                        <span className="text-[#94a3b8]">{field.label}</span>
                        {field.required && <span className="text-red-400">*</span>}
                        <span className="text-[#64748b]">→</span>
                        <span className={mappedCol ? 'text-[#3b82f6]' : 'text-[#64748b]'}>
                          {mappedCol ? headers[parseInt(mappedCol[0])] : '未识别'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-[#2a2d35] overflow-hidden">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#0f1117] sticky top-0">
                      <tr>
                        {headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left text-[#94a3b8] font-medium border-b border-[#2a2d35]">
                            {h}
                            {fieldMapping[String(i)] && (
                              <span className="ml-1 text-[#3b82f6]">
                                ({FIELD_MAP.find((f) => f.key === fieldMapping[String(i)])?.label})
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 10).map((row, ri) => (
                        <tr key={ri} className="border-b border-[#2a2d35]/50">
                          {headers.map((_, ci) => {
                            const mappedField = fieldMapping[String(ci)] as keyof ImportRow;
                            const val = mappedField ? (row as Record<string, unknown>)[mappedField] : undefined;
                            return (
                              <td key={ci} className="px-3 py-2 text-[#e2e8f0]">
                                {val !== undefined ? String(val) : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 10 && (
                  <p className="px-3 py-2 text-xs text-[#64748b] bg-[#0f1117]">
                    还有 {rows.length - 10} 行数据未显示...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Result (shared) ── */}
          {step === 'result' && (
            <div className="space-y-4">
              {mode === 'excel' && result ? (
                <>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-[#0f1117] border border-[#2a2d35]">
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-green-400">{result.success}</p>
                      <p className="text-xs text-[#94a3b8]">成功</p>
                    </div>
                    <div className="w-px h-10 bg-[#2a2d35]" />
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-yellow-400">{result.skipped}</p>
                      <p className="text-xs text-[#94a3b8]">跳过</p>
                    </div>
                    <div className="w-px h-10 bg-[#2a2d35]" />
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                      <p className="text-xs text-[#94a3b8]">失败</p>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 max-h-[200px] overflow-y-auto">
                      <p className="text-xs text-red-400 mb-2">错误详情：</p>
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs text-[#94a3b8] py-0.5">{err}</p>
                      ))}
                    </div>
                  )}
                  {result.success > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <p className="text-xs text-green-400">成功导入 {result.success} 位候选人</p>
                    </div>
                  )}
                </>
              ) : mode === 'resume' && resumeResult ? (
                <>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-[#0f1117] border border-[#2a2d35]">
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-green-400">{resumeResult.created}</p>
                      <p className="text-xs text-[#94a3b8]">已创建</p>
                    </div>
                    <div className="w-px h-10 bg-[#2a2d35]" />
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-yellow-400">{resumeResult.skipped}</p>
                      <p className="text-xs text-[#94a3b8]">跳过(重复)</p>
                    </div>
                    <div className="w-px h-10 bg-[#2a2d35]" />
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-red-400">{resumeResult.failed}</p>
                      <p className="text-xs text-[#94a3b8]">失败</p>
                    </div>
                  </div>

                  {/* Per-file detail list */}
                  <div className="rounded-lg border border-[#2a2d35] bg-[#0f1117] max-h-[250px] overflow-y-auto">
                    <p className="text-xs text-[#94a3b8] px-3 py-2 border-b border-[#2a2d35]">处理明细：</p>
                    {parseResults.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-[#2a2d35]/30 last:border-b-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.success ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          )}
                          <span className="text-xs text-[#e2e8f0] truncate">{item.fileName}</span>
                        </div>
                        <span className="text-xs text-[#94a3b8] shrink-0 ml-2">
                          {item.success ? (item.data?.name || 'OK') : (item.error?.slice(0, 30) || '失败')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {resumeResult.errors.length > 0 && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 max-h-[120px] overflow-y-auto">
                      <p className="text-xs text-red-400 mb-1">错误：</p>
                      {resumeResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-[#94a3b8] py-0.5">{err}</p>
                      ))}
                    </div>
                  )}

                  {resumeResult.created > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-[#10b981]/5 border border-[#10b981]/20">
                      <CheckCircle className="w-4 h-4 text-[#10b981]" />
                      <p className="text-xs text-[#10b981]">成功从 {resumeResult.created} 份简历创建候选人并加入人才库</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2a2d35]">
          {(step === 'upload' || step === 'preview') && (
            <button
              onClick={resetToModes}
              className="px-4 py-2 rounded-lg text-sm text-[#94a3b8] hover:bg-[#2a2d35] transition-colors"
            >
              返回
            </button>
          )}
          {step === 'preview' && mode === 'excel' && (
            <button
              onClick={handleExcelImport}
              disabled={loading || rows.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              确认导入
            </button>
          )}
          {step === 'result' && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
