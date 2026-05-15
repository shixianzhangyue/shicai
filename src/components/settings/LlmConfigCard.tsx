import { useState } from 'react';
import type { LlmConfig } from '@/types';
import { useLlmConfigStore } from '@/stores/llmConfigStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Pencil, Trash2, Star, Check, X, Eye, EyeOff } from 'lucide-react';

interface LlmConfigCardProps {
  config: LlmConfig;
  onSetDefault: () => void;
}

function LlmConfigCard({ config, onSetDefault }: LlmConfigCardProps) {
  const { updateConfig, deleteConfig } = useLlmConfigStore();
  const [editing, setEditing] = useState(false);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState(config.modelName);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const providerLabelMap: Record<string, string> = {
    openai: 'OpenAI',
    baidu_ernie: '百度 ERNIE',
    qwen: '通义千问',
    xunfei: '讯飞星火',
    custom: '自定义',
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const update: Partial<Omit<LlmConfig, 'id' | 'createdAt' | 'updatedAt'>> = {};
      if (baseUrl !== config.baseUrl) update.baseUrl = baseUrl;
      if (modelName !== config.modelName) update.modelName = modelName;
      if (apiKey.trim()) update.apiKey = apiKey;
      if (Object.keys(update).length > 0) {
        await updateConfig(config.id, update);
      }
      setEditing(false);
      setApiKey('');
    } catch {
      // error handled by store
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('确定要删除此配置吗？')) return;
    setDeleting(true);
    try {
      await deleteConfig(config.id);
    } catch {
      // error handled by store
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        {editing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#e2e8f0]">
                {providerLabelMap[config.provider] || config.provider}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(false)}
                  className="p-1 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>API Key (留空保持不变)</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="留空表示不修改"
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
              <Input value={modelName} onChange={(e) => setModelName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSaveEdit}
                disabled={saving}
                size="sm"
                className="inline-flex items-center gap-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                <Check className="w-3 h-3" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#e2e8f0]">
                {providerLabelMap[config.provider] || config.provider}
              </span>
              <span className="text-xs text-[#94a3b8]">{config.modelName}</span>
              {config.isDefault && (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                  <Star className="w-3 h-3 fill-yellow-400" />
                  默认
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!config.isDefault && (
                <button
                  onClick={onSetDefault}
                  className="p-1.5 rounded-md text-[#94a3b8] hover:text-yellow-400 hover:bg-[#2a2d35] transition-colors"
                  title="设为默认"
                >
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-md text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#2a2d35] transition-colors"
                title="编辑"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 rounded-md text-[#94a3b8] hover:text-red-400 hover:bg-[#2a2d35] transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LlmConfigCard;
