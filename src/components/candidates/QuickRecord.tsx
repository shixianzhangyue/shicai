import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCandidateStore } from '@/stores/candidateStore';
import { api } from '@/lib/api';
import { X, Zap, User, Phone } from 'lucide-react';

interface QuickRecordProps {
  open: boolean;
  onClose: () => void;
}

export function QuickRecord({ open, onClose }: QuickRecordProps) {
  const { nameMap, phoneLast4Map, loadSearchIndex } = useCandidateStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [content, setContent] = useState('');
  const [matches, setMatches] = useState<{ id: string; name: string; phoneLast4: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLInputElement>(null);

  // Load search index on mount if not loaded
  useEffect(() => {
    if (nameMap.size === 0) {
      loadSearchIndex();
    }
  }, [nameMap.size, loadSearchIndex]);

  // Auto-focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // Handle keyboard shortcut (Ctrl+Shift+N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        // Toggle: if already open, close it; otherwise open
        if (open) {
          onClose();
        } else {
          // We need to notify parent to open - this is handled by the parent component
          // The parent should listen for this event
        }
      }
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Search logic: prefix match on nameMap, or phone last-4 match
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    setSelectedCandidateId(null);
    setSelectedName('');

    if (!term.trim()) {
      setMatches([]);
      return;
    }

    const results: { id: string; name: string; phoneLast4: string | null }[] = [];
    const seen = new Set<string>();

    // If input is exactly 4 digits, try phoneLast4Map first
    if (/^\d{4}$/.test(term.trim())) {
      const ids = phoneLast4Map.get(term.trim()) || [];
      for (const id of ids) {
        if (!seen.has(id)) {
          const name = [...nameMap.entries()].find(([, v]) => v === id)?.[0];
          if (name) {
            results.push({ id, name, phoneLast4: term.trim() });
            seen.add(id);
          }
        }
      }
    }

    // Prefix match on nameMap
    const lowerTerm = term.toLowerCase();
    for (const [name, id] of nameMap.entries()) {
      if (name.toLowerCase().startsWith(lowerTerm) && !seen.has(id)) {
        // Find phoneLast4
        let pl4: string | null = null;
        for (const [p4, ids] of phoneLast4Map.entries()) {
          if (ids.includes(id)) {
            pl4 = p4;
            break;
          }
        }
        results.push({ id, name, phoneLast4: pl4 });
        seen.add(id);
      }
    }

    // Limit to 8 results
    setMatches(results.slice(0, 8));
  }, [nameMap, phoneLast4Map]);

  const handleSelect = (id: string, name: string) => {
    setSelectedCandidateId(id);
    setSelectedName(name);
    setSearchTerm(name);
    setMatches([]);
    setTimeout(() => contentRef.current?.focus(), 50);
  };

  const handleSubmit = async () => {
    if (!selectedCandidateId || !content.trim()) return;
    setLoading(true);
    try {
      await api.followUps.create({
        candidateId: selectedCandidateId,
        content: content.trim(),
        followType: 'other',
      });
      // Reset and close
      setSearchTerm('');
      setSelectedCandidateId(null);
      setSelectedName('');
      setContent('');
      setMatches([]);
      onClose();
    } catch (err) {
      console.error('Failed to create follow-up:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border border-[#2a2d35] bg-[#1a1d24] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d35]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-sm font-medium text-[#e2e8f0]">快速记录</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#2a2d35] text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Candidate Search */}
          <div className="relative">
            <label className="text-xs text-[#94a3b8] mb-1.5 block">选择候选人</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <input
                ref={searchRef}
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="输入姓名或手机号后4位..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#0f1117] border border-[#2a2d35] text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-[#3b82f6]/50"
              />
            </div>

            {/* Dropdown matches */}
            {matches.length > 0 && !selectedCandidateId && (
              <div className="absolute z-10 w-full mt-1 rounded-lg border border-[#2a2d35] bg-[#1a1d24] shadow-lg overflow-hidden">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m.id, m.name)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#2a2d35] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-[#3b82f6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e2e8f0] truncate">{m.name}</p>
                      {m.phoneLast4 && (
                        <p className="text-xs text-[#94a3b8] flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          ****{m.phoneLast4}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected candidate badge */}
          {selectedCandidateId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30">
              <User className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-sm text-[#e2e8f0]">{selectedName}</span>
              <button
                onClick={() => {
                  setSelectedCandidateId(null);
                  setSelectedName('');
                  setSearchTerm('');
                  setTimeout(() => searchRef.current?.focus(), 50);
                }}
                className="ml-auto p-0.5 rounded hover:bg-[#3b82f6]/20 text-[#94a3b8]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Content input */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">跟进内容</label>
            <input
              ref={contentRef}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="输入一句话跟进记录，回车提交..."
              className="w-full h-10 px-4 rounded-lg bg-[#0f1117] border border-[#2a2d35] text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-[#3b82f6]/50"
            />
          </div>

          {/* Hint */}
          <p className="text-xs text-[#64748b]">
            提示：Ctrl+Shift+N 快速唤起，Esc 关闭
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#2a2d35]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-[#94a3b8] hover:bg-[#2a2d35] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedCandidateId || !content.trim() || loading}
            className="px-4 py-1.5 rounded-lg text-sm bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </div>
  );
}
