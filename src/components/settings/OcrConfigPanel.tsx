import { useState, useEffect, useCallback } from 'react';
import type { OcrConfig, CreateOcrConfigInput, UpdateOcrConfigInput } from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, TestTube, Save, Star, Trash2 } from 'lucide-react';

function OcrConfigCard({
  config,
  onSetDefault,
  onDelete,
}: {
  config: OcrConfig;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  return (
    <Card className="relative">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#e2e8f0]">
              {config.provider === 'baidu' ? '百度 OCR' : config.provider}
            </span>
            {config.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#3b82f6]/20 text-[#3b82f6]">
                <Star className="w-3 h-3" />
                默认
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!config.isDefault && (
              <Button
                onClick={onSetDefault}
                variant="ghost"
                size="sm"
                className="text-xs text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
              >
                设为默认
              </Button>
            )}
            <Button
              onClick={onDelete}
              variant="ghost"
              size="sm"
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-[#94a3b8]">API Key</Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                readOnly
                className="text-xs bg-[#1e2128] border-[#2a2d35] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-[#94a3b8]">Secret Key</Label>
            <div className="relative">
              <Input
                type={showSecretKey ? 'text' : 'password'}
                value={config.secretKey}
                readOnly
                className="text-xs bg-[#1e2128] border-[#2a2d35] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                {showSecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#94a3b8]">
          创建时间: {new Date(config.createdAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function OcrConfigPanel() {
  const [configs, setConfigs] = useState<OcrConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.ocrConfigs.list();
      setConfigs(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleTest = useCallback(async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      setError('请填写 API Key 和 Secret Key 后再测试');
      return;
    }
    setError('');
    setTesting(true);
    setTestStatus(null);
    try {
      const message = await api.ocrConfigs.test({
        provider: 'baidu',
        apiKey,
        secretKey,
      });
      setTestStatus({ success: true, message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestStatus({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  }, [apiKey, secretKey]);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      setError('API Key 和 Secret Key 不能为空');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const input: CreateOcrConfigInput = {
        provider: 'baidu',
        apiKey,
        secretKey,
      };
      await api.ocrConfigs.create(input);
      setApiKey('');
      setSecretKey('');
      setTestStatus(null);
      fetchConfigs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [apiKey, secretKey, fetchConfigs]);

  const handleSetDefault = useCallback(async (id: number) => {
    try {
      const input: UpdateOcrConfigInput = { isDefault: true };
      await api.ocrConfigs.update(id, input);
      fetchConfigs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, [fetchConfigs]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.ocrConfigs.delete(id);
      fetchConfigs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, [fetchConfigs]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label>提供商</Label>
            <Input
              value="百度 OCR"
              readOnly
              className="bg-[#1e2128] border-[#2a2d35]"
            />
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入百度 OCR API Key"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Secret Key</Label>
            <div className="relative">
              <Input
                type={showSecretKey ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="输入百度 OCR Secret Key"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {testStatus && (
            <div
              className={`text-sm flex items-center gap-2 ${
                testStatus.success ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {testStatus.success ? '✓' : '✗'}
              {testStatus.message}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <Button
              onClick={handleTest}
              disabled={testing}
              variant="ghost"
              className="inline-flex items-center gap-2 text-[#e2e8f0] hover:bg-[#2a2d35]"
            >
              <TestTube className="w-4 h-4" />
              {testing ? '测试中...' : '测试连接'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-[#e2e8f0]">已保存配置</h3>
        {loading && configs.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">加载中...</p>
        ) : configs.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">暂无配置，请在上方添加</p>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <OcrConfigCard
                key={config.id}
                config={config}
                onSetDefault={() => handleSetDefault(config.id)}
                onDelete={() => handleDelete(config.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OcrConfigPanel;