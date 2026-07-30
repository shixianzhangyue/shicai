import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CloudConfig, SaveCloudConfigInput, SyncLogEntry } from '@/types';
import {
  Download, Upload, RotateCcw, Loader2, AlertTriangle, CheckCircle2,
  Cloud, CloudOff, Link, RefreshCw, History, HardDrive,
  Settings, Trash2, TestTube, Eye, EyeOff,
} from 'lucide-react';
import { confirm } from '@/components/ui/ConfirmDialog';

// ─── Provider definitions ─────────────────────────
const PROVIDERS = [
  { id: 'baidu', name: '百度网盘', icon: '☁️', color: '#306cff', fields: ['accessToken'] },
  { id: 'onedrive', name: 'OneDrive', icon: '🔷', color: '#0078d4', fields: ['oauth'] },
  { id: 'nutstore', name: '坚果云', icon: '🥜', color: '#8b6914', fields: ['serverUrl', 'username', 'password'] },
  { id: 'webdav', name: 'WebDAV', icon: '🌐', color: '#6366f1', fields: ['serverUrl', 'username', 'password'] },
  { id: 's3', name: 'S3 存储', icon: '🪣', color: '#ff9900', fields: ['serverUrl', 'bucket', 'region', 'username', 'password'] },
] as const;

type ProviderId = typeof PROVIDERS[number]['id'];

const FIELD_LABELS: Record<string, string> = {
  accessToken: 'Access Token',
  refreshToken: 'Refresh Token',
  serverUrl: '服务器地址',
  bucket: 'Bucket 名称',
  region: 'Region (可选)',
  username: '用户名 / Access Key',
  password: '密码 / Secret Key',
};

function BackupRestore() {
  // Local backup state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [confirmRollbackOpen, setConfirmRollbackOpen] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [hasBak, setHasBak] = useState(false);

  // Cloud state
  const [activeTab, setActiveTab] = useState<ProviderId>('onedrive');
  const [cloudConfigs, setCloudConfigs] = useState<CloudConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [syncingToCloud, setSyncingToCloud] = useState(false);
  const [syncingFromCloud, setSyncingFromCloud] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmCloudRestoreOpen, setConfirmCloudRestoreOpen] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      const configs = await api.cloudSync.getAllStatus();
      setCloudConfigs(configs);
    } catch {
      // Ignore
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  useEffect(() => {
    setHasBak(true);
    fetchConfigs();
  }, [fetchConfigs]);

  // Get current tab's config
  const currentConfig = cloudConfigs.find(c => c.provider === activeTab);
  const isConnected = currentConfig?.tokenValid || false;

  // ─── Local Backup Handlers ─────────────────────

  const handleExport = async () => {
    setError(''); setSuccess('');
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const path = await save({ defaultPath: `shicore-backup-${ts}.zip`, filters: [{ name: 'ZIP', extensions: ['zip'] }] });
    if (!path) return;
    setExporting(true);
    try {
      await api.backup.export(path);
      setSuccess('备份导出成功');
      localStorage.setItem('lastBackupTime', new Date().toISOString());
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setExporting(false); }
  };

  const handleImportClick = async () => {
    setError(''); setSuccess('');
    const selected = await open({ multiple: false, filters: [{ name: 'ZIP', extensions: ['zip'] }] });
    if (selected && typeof selected === 'string') { setImportPath(selected); setConfirmImportOpen(true); }
  };

  const handleConfirmImport = async () => {
    setConfirmImportOpen(false); setImporting(true);
    try { const msg = await api.backup.import(importPath); setSuccess(`${msg}，请重启应用`); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setImporting(false); }
  };

  const handleConfirmRollback = async () => {
    setConfirmRollbackOpen(false); setRollingBack(true);
    try { const msg = await api.backup.rollback(); setSuccess(`${msg}，请重启应用`); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setRollingBack(false); }
  };

  // ─── Cloud Handlers ─────────────────────

  const handleSaveConfig = async () => {
    setError(''); setSuccess('');
    try {
      const input: SaveCloudConfigInput = { provider: activeTab, ...configForm };
      await api.cloudSync.saveConfig(input);
      setSuccess(`${PROVIDERS.find(p => p.id === activeTab)?.name} 配置已保存`);
      setEditingConfig(false);
      fetchConfigs();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  const handleTestConnection = async () => {
    setError(''); setSuccess(''); setTesting(true);
    try {
      const msg = await api.cloudSync.testConnection(activeTab);
      setSuccess(msg);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setTesting(false); }
  };

  const handleConnectOAuth = async () => {
    setError(''); setSuccess('');
    try {
      const authUrl = await api.cloudSync.initOAuth();
      window.open(authUrl, '_blank');
      const code = prompt('请在浏览器中完成 OneDrive 授权，然后将授权码粘贴到这里：');
      if (code) {
        const result = await api.cloudSync.completeOAuth(code);
        if (result.success) { setSuccess(result.message); fetchConfigs(); }
        else { setError(result.message); }
      }
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  const handleSyncToCloud = async () => {
    setError(''); setSuccess(''); setSyncingToCloud(true);
    try {
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const fileName = `shicore-cloud-${ts}.zip`;
      const tempDir = await import('@tauri-apps/api/path').then(m => m.tempDir());
      const tempPath = `${tempDir}${fileName}`;
      await api.backup.export(tempPath);
      await api.cloudSync.syncToCloud(activeTab, tempPath, fileName);
      setSuccess(`已备份到 ${PROVIDERS.find(p => p.id === activeTab)?.name}`);
      localStorage.setItem('lastCloudBackupTime', new Date().toISOString());
      fetchConfigs();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSyncingToCloud(false); }
  };

  const handleSyncFromCloudClick = () => {
    setError(''); setSuccess(''); setConfirmCloudRestoreOpen(true);
  };

  const handleConfirmCloudRestore = async () => {
    setConfirmCloudRestoreOpen(false); setSyncingFromCloud(true);
    try {
      const tempDir = await import('@tauri-apps/api/path').then(m => m.tempDir());
      const localPath = `${tempDir}shicore-restore.zip`;
      const cloudPath = `${currentConfig?.syncPath || '/Shicore'}/shicore-cloud-latest.zip`;
      await api.cloudSync.syncFromCloud(activeTab, cloudPath, localPath);
      const msg = await api.backup.import(localPath);
      setSuccess(`${msg}，请重启应用`);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSyncingFromCloud(false); }
  };

  const handleShowLogs = async () => {
    if (showLogs) { setShowLogs(false); return; }
    setLoadingLogs(true);
    try { setSyncLogs(await api.cloudSync.getLog(activeTab)); setShowLogs(true); }
    catch { /* ignore */ }
    finally { setLoadingLogs(false); }
  };

  const handleDeleteConfig = async () => {
    if (!await confirm(`确定删除 ${PROVIDERS.find(p => p.id === activeTab)?.name} 的配置？`)) return;
    try {
      await api.cloudSync.deleteConfig(activeTab);
      setSuccess('配置已删除');
      fetchConfigs();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  const currentProvider = PROVIDERS.find(p => p.id === activeTab)!;
  const lastBackupTime = localStorage.getItem('lastBackupTime');
  const lastCloudBackupTime = localStorage.getItem('lastCloudBackupTime');

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

      {/* ─── Cloud Backup ─────────────────────── */}
      <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="w-4 h-4 text-[#3b82f6]" />
          <h3 className="text-sm font-medium text-[#e2e8f0]">网盘备份</h3>
        </div>

        {/* Provider Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-[#0f1117] rounded-lg">
          {PROVIDERS.map(p => {
            const cfg = cloudConfigs.find(c => c.provider === p.id);
            const active = activeTab === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { setActiveTab(p.id); setEditingConfig(false); setShowLogs(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                  active ? 'bg-[#2a2d35] text-[#e2e8f0]' : 'text-[#94a3b8] hover:text-[#e2e8f0]'
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
                {cfg?.tokenValid && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </div>

        {loadingConfigs ? (
          <div className="flex items-center gap-2 py-6 text-xs text-[#94a3b8] justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {isConnected ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 已连接
                    {currentConfig?.lastSyncAt && (
                      <span className="text-[#64748b] ml-2">
                        上次同步: {new Date(currentConfig.lastSyncAt).toLocaleString('zh-CN')}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[#94a3b8] flex items-center gap-1.5">
                    <CloudOff className="w-3.5 h-3.5" /> 未连接
                  </span>
                )}
              </div>
              {currentConfig && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingConfig(!editingConfig)}
                    className="text-[#94a3b8] hover:text-[#e2e8f0] h-7 px-2"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteConfig}
                    className="text-[#94a3b8] hover:text-red-400 h-7 px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Config form */}
            {(editingConfig || !currentConfig) && (
              <div className="space-y-3 p-3 bg-[#0f1117] rounded-lg border border-[#2a2d35]">
                {activeTab === 'onedrive' ? (
                  <Button onClick={handleConnectOAuth} className="bg-[#0078d4] hover:bg-[#006abc] text-white w-full">
                    <Link className="w-4 h-4 mr-2" /> 连接 OneDrive (OAuth)
                  </Button>
                ) : (
                  <>
                    {currentProvider.fields.map(field => (
                      <div key={field}>
                        <label className="text-xs text-[#94a3b8] mb-1 block">{FIELD_LABELS[field]}</label>
                        <div className="relative">
                          <input
                            type={field === 'password' && !showPassword ? 'password' : 'text'}
                            value={configForm[field] || ''}
                            onChange={e => setConfigForm(prev => ({ ...prev, [field]: e.target.value }))}
                            placeholder={FIELD_LABELS[field]}
                            className="w-full bg-[#1a1d24] border border-[#2a2d35] rounded-md px-3 py-1.5 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
                          />
                          {field === 'password' && (
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#e2e8f0]"
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button onClick={handleSaveConfig} size="sm" className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
                        保存配置
                      </Button>
                      <Button onClick={handleTestConnection} size="sm" variant="outline" disabled={testing}
                        className="border-[#2a2d35] text-[#e2e8f0] hover:bg-[#2a2d35]">
                        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <TestTube className="w-3.5 h-3.5 mr-1" />}
                        测试连接
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
            {isConnected && !editingConfig && (
              <div className="flex gap-3">
                <Button onClick={handleSyncToCloud} disabled={syncingToCloud}
                  className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
                  {syncingToCloud ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <HardDrive className="w-4 h-4 mr-2" />}
                  {syncingToCloud ? '备份中...' : '备份到云端'}
                </Button>
                <Button onClick={handleSyncFromCloudClick} disabled={syncingFromCloud} variant="outline"
                  className="border-[#2a2d35] text-[#e2e8f0] hover:bg-[#1a1d24]">
                  {syncingFromCloud ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  从云端恢复
                </Button>
                <Button onClick={handleShowLogs} variant="ghost"
                  className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]">
                  {loadingLogs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <History className="w-4 h-4 mr-2" />}
                  {showLogs ? '隐藏日志' : '同步日志'}
                </Button>
              </div>
            )}

            {/* Sync logs */}
            {showLogs && (
              <div className="rounded-lg border border-[#2a2d35] bg-[#0f1117] overflow-hidden">
                {syncLogs.length === 0 ? (
                  <p className="text-xs text-[#64748b] text-center py-4">暂无同步记录</p>
                ) : (
                  <div className="divide-y divide-[#2a2d35] max-h-48 overflow-y-auto">
                    {syncLogs.map(log => (
                      <div key={log.id} className="px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.syncStatus === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          )}
                          <span className="text-xs text-[#e2e8f0]">
                            {log.fileType === 'backup' ? '上传' : '下载'}: {log.cloudPath.split('/').pop()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {log.fileSize && <span className="text-[10px] text-[#64748b]">{(log.fileSize / 1024 / 1024).toFixed(1)} MB</span>}
                          <span className="text-[10px] text-[#64748b]">{log.syncedAt ? new Date(log.syncedAt).toLocaleString('zh-CN') : '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Local Export ─────────────────────── */}
      <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5">
        <h3 className="text-sm font-medium text-[#e2e8f0] mb-1">本地备份</h3>
        <p className="text-xs text-[#94a3b8] mb-4">将数据库和简历文件打包为 zip 存档</p>
        {lastBackupTime && <p className="text-xs text-[#64748b] mb-3">上次备份：{new Date(lastBackupTime).toLocaleString('zh-CN')}</p>}
        <Button onClick={handleExport} disabled={exporting} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          导出备份
        </Button>
      </div>

      {/* ─── Local Import ─────────────────────── */}
      <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5">
        <h3 className="text-sm font-medium text-[#e2e8f0] mb-1">数据恢复</h3>
        <p className="text-xs text-[#94a3b8] mb-4">从备份文件恢复数据，系统会自动创建回滚点</p>
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" /> 恢复将覆盖当前所有数据
        </div>
        <Button onClick={handleImportClick} disabled={importing} variant="outline"
          className="border-[#2a2d35] text-[#e2e8f0] hover:bg-[#1a1d24]">
          {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          导入恢复
        </Button>
      </div>

      {/* ─── Rollback ─────────────────────── */}
      {hasBak && (
        <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-5">
          <h3 className="text-sm font-medium text-[#e2e8f0] mb-1">回滚管理</h3>
          <p className="text-xs text-[#94a3b8] mb-4">如果恢复后出现异常，可回滚到恢复前的状态</p>
          <Button onClick={() => { setError(''); setSuccess(''); setConfirmRollbackOpen(true); }}
            disabled={rollingBack} variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400">
            {rollingBack ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            回滚到上一版本
          </Button>
        </div>
      )}

      {/* ─── Dialogs ─────────────────────── */}
      <Dialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" />确认恢复？</DialogTitle>
            <DialogDescription>恢复将覆盖当前所有数据。选中文件：{importPath}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmImportOpen(false)} className="text-[#94a3b8]">取消</Button>
            <Button onClick={handleConfirmImport} className="bg-amber-500 hover:bg-amber-600 text-white">确认恢复</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRollbackOpen} onOpenChange={setConfirmRollbackOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" />确认回滚？</DialogTitle>
            <DialogDescription>回滚将丢弃恢复后的所有变更</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRollbackOpen(false)} className="text-[#94a3b8]">取消</Button>
            <Button onClick={handleConfirmRollback} className="bg-red-500 hover:bg-red-600 text-white">确认回滚</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCloudRestoreOpen} onOpenChange={setConfirmCloudRestoreOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" />从云端恢复？</DialogTitle>
            <DialogDescription>将从 {currentProvider.name} 下载最新备份并恢复，当前数据会被覆盖。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCloudRestoreOpen(false)} className="text-[#94a3b8]">取消</Button>
            <Button onClick={handleConfirmCloudRestore} className="bg-amber-500 hover:bg-amber-600 text-white">确认恢复</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BackupRestore;
