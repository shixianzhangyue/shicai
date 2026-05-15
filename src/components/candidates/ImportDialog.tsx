import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ImportRow, ImportResult } from '@/types';
import { read, utils } from 'xlsx';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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

export function ImportDialog({ open, onClose, onSuccess }: ImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
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

      // Parse rows
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
      console.error('Failed to parse file:', err);
      alert('文件解析失败，请检查文件格式');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = async () => {
    setLoading(true);
    const importResult: ImportResult = { success: 0, skipped: 0, failed: 0, errors: [] };

    for (const row of rows) {
      try {
        // Validate: name is required
        if (!row.name || row.name.trim() === '') {
          importResult.failed++;
          importResult.errors.push(`跳过空姓名行`);
          continue;
        }

        // Check duplicate by phone
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

        // Normalize education
        let education = row.education;
        if (education) {
          const matched = EDUCATION_OPTIONS.find((e) => education!.includes(e));
          if (matched) education = matched;
        }

        // Create candidate
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
      handleFileSelect(droppedFile);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl mx-4 rounded-xl border border-[#2a2d35] bg-[#1a1d24] shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d35]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#3b82f6]" />
            <span className="text-sm font-medium text-[#e2e8f0]">批量导入候选人</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#2a2d35] text-[#94a3b8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
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
                  if (f) handleFileSelect(f);
                }}
              />
            </div>
          )}

          {/* Step: Preview & Mapping */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#94a3b8]">
                  共 <span className="text-[#e2e8f0] font-medium">{rows.length}</span> 条数据
                  {file && <span className="ml-2 text-xs text-[#64748b]">({file.name})</span>}
                </p>
                <button
                  onClick={() => setStep('upload')}
                  className="text-xs text-[#3b82f6] hover:underline"
                >
                  重新上传
                </button>
              </div>

              {/* Field mapping */}
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

              {/* Preview table */}
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

          {/* Step: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2a2d35]">
          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-lg text-sm text-[#94a3b8] hover:bg-[#2a2d35] transition-colors"
              >
                上一步
              </button>
              <button
                onClick={handleImport}
                disabled={loading || rows.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                确认导入
              </button>
            </>
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
