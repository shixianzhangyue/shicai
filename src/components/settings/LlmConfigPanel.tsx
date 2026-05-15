import { useState, useEffect, useCallback } from 'react';
import type { ProviderType } from '@/types';
import { useLlmConfigStore } from '@/stores/llmConfigStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, TestTube, Save, Star } from 'lucide-react';
import LlmConfigCard from './LlmConfigCard';

const PROVIDER_OPTIONS: { value: ProviderType; label: string; defaultBaseUrl: string; defaultModel: string }[] = [
  { value: 'openai', label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { value: 'baidu_ernie', label: '百度 ERNIE', defaultBaseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat', defaultModel: 'ernie-lite-8k' },
  { value: 'qwen', label: '通义千问', defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1', defaultModel: 'qwen-turbo' },
  { value: 'xunfei', label: '讯飞星火', defaultBaseUrl: 'https://spark-api-open.xf-yun.com/v1', defaultModel: 'generalv3.5' },
  { value: 'custom', label: '自定义', defaultBaseUrl: '', defaultModel: '' },
];

function LlmConfigPanel() {
  const { configs, loading, fetchConfigs, createConfig, setDefault } = useLlmConfigStore();

  const [provider, setProvider] = useState<ProviderType>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    const found = PROVIDER_OPTIONS.find((p) => p.value === provider);
    if (found) {
      setBaseUrl(found.defaultBaseUrl);
      setModelName(found.defaultModel);
    }
  }, [provider]);

  const handleTest = useCallback(async () => {
    if (!apiKey.trim() || !baseUrl.trim() || !modelName.trim()) {
      setError('请填写完整配置信息后再测试');
      return;
    }
    setError('');
    setTesting(true);
    setTestStatus(null);
    try {
      const message = await api.llmConfigs.test({
        provider,
        apiKey,
        baseUrl,
        modelName,
      });
      setTestStatus({ success: true, message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestStatus({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  }, [apiKey, baseUrl, modelName, provider]);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim() || !baseUrl.trim() || !modelName.trim()) {
      setError('Provider、Base URL、API Key 和 Model Name 不能为空');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await createConfig({ provider, apiKey, baseUrl, modelName, isDefault: configs.length === 0 });
      setApiKey('');
      setTestStatus(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [apiKey, baseUrl, modelName, provider, configs.length, createConfig]);

  const selectOptions = PROVIDER_OPTIONS.map((p) => ({ value: p.value, label: p.label }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label>提供商</Label>
            <Select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
              options={selectOptions}
            />
          </div>

          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如 https://api.openai.com/v1"
            />
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入 API Key"
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
            <Label>模型名称</Label>
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="例如 gpt-4o-mini"
            />
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
              <LlmConfigCard
                key={config.id}
                config={config}
                onSetDefault={() => setDefault(config.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LlmConfigPanel;
