import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Download,
  Upload,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

function BackupRestore() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [confirmRollbackOpen, setConfirmRollbackOpen] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [hasBak, setHasBak] = useState(false);
  const [checkingBak, setCheckingBak] = useState(false);

  const checkBak = useCallback(async () => {
    setCheckingBak(true);
    try {
      // We can't directly list files from Rust without a command,
      // so we'll attempt rollback and catch "not found" as a proxy,
      // or just always show the button and let the command fail gracefully.
      // For better UX, we just enable it; the Rust command will error if no .bak.
      setHasBak(true);
    } finally {
      setCheckingBak(false);
    }
  }, []);

  useEffect(() => {
    checkBak();
  }, [checkBak]);

  const handleExport = async () => {
    setError('');
    setSuccess('');
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const path = await save({
      defaultPath: `talent-vault-backup-${ts}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (!path) return;

    setExporting(true);
    try {
      await api.backup.export(path);
      setSuccess('备份导出成功');
      localStorage.setItem('lastBackupTime', new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = async () => {
    setError('');
    setSuccess('');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (selected && typeof selected === 'string') {
      setImportPath(selected);
      setConfirmImportOpen(true);
    }
  };

  const handleConfirmImport = async () => {
    setConfirmImportOpen(false);
    setImporting(true);
    try {
      const msg = await api.backup.import(importPath);
      setSuccess(`${msg}，请重启应用以完成数据加载`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleRollbackClick = () => {
    setError('');
    setSuccess('');
    setConfirmRollbackOpen(true);
  };

  const handleConfirmRollback = async () => {
    setConfirmRollbackOpen(false);
    setRollingBack(true);
    try {
      const msg = await api.backup.rollback();
      setSuccess(`${msg}，请重启应用以完成数据加载`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setRollingBack(false);
    }
  };

  const lastBackupTime = localStorage.getItem('lastBackupTime');

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Export backup */}
      <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5">
        <h3 className="text-sm font-medium text-[#e2e8f0] mb-1">数据备份</h3>
        <p className="text-xs text-[#94a3b8] mb-4">
          将数据库和所有简历文件打包为 zip 存档
        </p>
        {lastBackupTime && (
          <p className="text-xs text-[#64748b] mb-3">
            上次备份：{new Date(lastBackupTime).toLocaleString('zh-CN')}
          </p>
        )}
        <Button
          onClick={handleExport}
          disabled={exporting}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          导出备份
        </Button>
      </div>

      {/* Import backup */}
      <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5">
        <h3 className="text-sm font-medium text-[#e2e8f0] mb-1">数据恢复</h3>
        <p className="text-xs text-[#94a3b8] mb-4">
          从备份文件恢复数据。系统会在恢复前自动创建回滚点。
        </p>
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          恢复将覆盖当前所有数据
        </div>
        <Button
          onClick={handleImportClick}
          disabled={importing}
          variant="outline"
          className="border-[#2a2d35] text-[#e2e8f0] hover:bg-[#1a1d24] hover:text-[#e2e8f0]"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          导入恢复
        </Button>
      </div>

      {/* Rollback */}
      {hasBak && (
        <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5">
          <h3 className="text-sm font-medium text-[#e2e8f0] mb-1">回滚管理</h3>
          <p className="text-xs text-[#94a3b8] mb-4">
            如果上次恢复后出现异常，可回滚到恢复前的状态
          </p>
          <Button
            onClick={handleRollbackClick}
            disabled={rollingBack || checkingBak}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
          >
            {rollingBack ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            回滚到上一版本
          </Button>
        </div>
      )}

      {/* Import Confirm Dialog */}
      <Dialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              确认恢复数据？
            </DialogTitle>
            <DialogDescription>
              恢复将覆盖当前所有数据。系统已自动创建回滚备份（.bak），可在异常时回滚。
              <br />
              <br />
              选中文件：{importPath}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmImportOpen(false)}
              className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmImport}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirm Dialog */}
      <Dialog open={confirmRollbackOpen} onOpenChange={setConfirmRollbackOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              确认回滚？
            </DialogTitle>
            <DialogDescription>
              回滚将丢弃恢复后的所有变更，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmRollbackOpen(false)}
              className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmRollback}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              确认回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BackupRestore;
