import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { RelationType, Candidate } from '@/types';
import { User, Link2, Trash2, Plus, X, UserPlus } from 'lucide-react';

interface RelationsTabProps {
  candidateId: string;
}

interface RelationItem {
  relation: {
    id: string;
    candidateIdA: string;
    candidateIdB: string;
    relationType: string;
    note: string | null;
    createdAt: string;
  };
  candidate: {
    id: string;
    name: string;
    currentCompany: string | null;
    currentPosition: string | null;
  };
}

const RELATION_TYPE_LABELS: Record<string, string> = {
  colleague: '同事',
  superior: '上级',
  referral: '推荐人',
  friend: '朋友',
  classmate: '同学',
  other: '其他',
};

const RELATION_TYPE_OPTIONS: { value: RelationType; label: string }[] = [
  { value: 'colleague', label: '同事' },
  { value: 'superior', label: '上级' },
  { value: 'referral', label: '推荐人' },
  { value: 'friend', label: '朋友' },
  { value: 'classmate', label: '同学' },
  { value: 'other', label: '其他' },
];

export function RelationsTab({ candidateId }: RelationsTabProps) {
  const [relations, setRelations] = useState<RelationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [relationType, setRelationType] = useState<RelationType>('colleague');
  const [note, setNote] = useState('');

  const fetchRelations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.relations.list(candidateId);
      setRelations(data as RelationItem[]);
    } catch (err) {
      console.error('Failed to fetch relations:', err);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  const handleSearchCandidates = async () => {
    if (!searchName.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const candidates = await api.candidates.list({ keyword: searchName.trim() });
      // Exclude self and already related candidates
      const relatedIds = new Set(relations.map((r) => r.candidate.id));
      const filtered = candidates.filter(
        (c) => c.id !== candidateId && !relatedIds.has(c.id)
      );
      setSearchResults(filtered.slice(0, 5));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleCreate = async () => {
    if (!selectedCandidate) return;
    try {
      await api.relations.create({
        candidateIdA: candidateId,
        candidateIdB: selectedCandidate.id,
        relationType,
        note: note || undefined,
      });
      setShowAddForm(false);
      setSelectedCandidate(null);
      setSearchName('');
      setSearchResults([]);
      setRelationType('colleague');
      setNote('');
      fetchRelations();
    } catch (err) {
      console.error('Failed to create relation:', err);
    }
  };

  const handleDelete = async (relationId: string) => {
    if (!window.confirm('确定要删除这条关系吗？')) return;
    try {
      await api.relations.delete(relationId);
      fetchRelations();
    } catch (err) {
      console.error('Failed to delete relation:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#e2e8f0]">
          关系网络 ({relations.length})
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAddForm ? '取消' : '添加关系'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-[#2a2d35] bg-[#0f1117] space-y-3">
          {/* Search candidate */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">关联候选人</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text"
                  value={selectedCandidate ? selectedCandidate.name : searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value);
                    setSelectedCandidate(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchCandidates()}
                  disabled={!!selectedCandidate}
                  placeholder="输入姓名搜索..."
                  className="w-full h-9 pl-10 pr-4 rounded-lg bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-[#3b82f6]/50 disabled:opacity-60"
                />
              </div>
              <button
                onClick={handleSearchCandidates}
                disabled={!!selectedCandidate}
                className="px-3 h-9 rounded-lg bg-[#2a2d35] text-[#94a3b8] text-sm hover:bg-[#3a3d45] disabled:opacity-50 transition-colors"
              >
                搜索
              </button>
            </div>

            {/* Search results */}
            {!selectedCandidate && searchResults.length > 0 && (
              <div className="mt-2 rounded-lg border border-[#2a2d35] bg-[#1a1d24] overflow-hidden">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCandidate(c);
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#2a2d35] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-[#3b82f6]" />
                    </div>
                    <div>
                      <p className="text-sm text-[#e2e8f0]">{c.name}</p>
                      {(c.currentCompany || c.currentPosition) && (
                        <p className="text-xs text-[#94a3b8]">
                          {[c.currentCompany, c.currentPosition].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Relation type */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">关系类型</label>
            <div className="flex flex-wrap gap-2">
              {RELATION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRelationType(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    relationType === opt.value
                      ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50'
                      : 'bg-[#1a1d24] text-[#94a3b8] border border-[#2a2d35] hover:border-[#3b82f6]/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">备注（可选）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="补充说明..."
              className="w-full h-9 px-3 rounded-lg bg-[#1a1d24] border border-[#2a2d35] text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-[#3b82f6]/50"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedCandidate(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs text-[#94a3b8] hover:bg-[#2a2d35] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!selectedCandidate}
              className="px-4 py-1.5 rounded-lg text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* Relations List */}
      {loading ? (
        <div className="py-8 text-center text-sm text-[#94a3b8]">加载中...</div>
      ) : relations.length === 0 ? (
        <div className="py-8 text-center">
          <Link2 className="w-10 h-10 mx-auto mb-3 text-[#2a2d35]" />
          <p className="text-sm text-[#94a3b8]">暂无关系记录</p>
          <p className="text-xs text-[#64748b] mt-1">点击「添加关系」建立候选人之间的关联</p>
        </div>
      ) : (
        <div className="space-y-2">
          {relations.map((item) => (
            <div
              key={item.relation.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[#2a2d35] bg-[#0f1117] hover:border-[#3b82f6]/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[#3b82f6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#e2e8f0]">
                    {item.candidate.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#3b82f6]/10 text-[#3b82f6]">
                    {RELATION_TYPE_LABELS[item.relation.relationType] || item.relation.relationType}
                  </span>
                </div>
                {(item.candidate.currentCompany || item.candidate.currentPosition) && (
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    {[item.candidate.currentCompany, item.candidate.currentPosition].filter(Boolean).join(' · ')}
                  </p>
                )}
                {item.relation.note && (
                  <p className="text-xs text-[#64748b] mt-1">{item.relation.note}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(item.relation.id)}
                className="p-1.5 rounded-md hover:bg-red-500/10 text-[#94a3b8] hover:text-red-400 transition-colors"
                title="删除关系"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
