import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Loader2, User, Phone, Mail, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { notify } from '@/lib/notify';
import type { Candidate } from '@/types';
import PageLayout from '@/components/layout/PageLayout';

export default function RecycleBin() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Candidate | null>(null);

  useEffect(() => {
    fetchDeleted();
  }, []);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const data = await api.candidates.listDeleted();
      setCandidates(data);
    } catch (err) {
      notify.error('Failed to fetch deleted candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setActionLoading(id);
    try {
      await api.candidates.restore(id);
      await fetchDeleted();
    } catch (err) {
      notify.error('Failed to restore candidate');
      alert('恢复失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(confirmDelete.id);
    try {
      await api.candidates.permanentlyDelete(confirmDelete.id);
      setConfirmDelete(null);
      await fetchDeleted();
    } catch (err) {
      notify.error('Failed to permanently delete candidate');
      alert('永久删除失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <PageLayout title="回收站" description="已删除的人才数据">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Trash2 className="w-12 h-12 mb-4 text-[#2a2d35]" />
          <p className="text-sm text-[#94a3b8]">回收站为空</p>
          <p className="text-xs text-[#64748b] mt-1">删除的人才将显示在这里</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2a2d35] bg-[#1a1d24] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d35] bg-[#0f1117]">
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">姓名</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">手机</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">邮箱</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">当前公司</th>
                <th className="px-4 py-3 text-left font-medium text-[#94a3b8]">删除时间</th>
                <th className="px-4 py-3 text-right font-medium text-[#94a3b8]">操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-[#2a2d35] last:border-0 hover:bg-[#22252d] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#2a2d35] flex items-center justify-center">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.name} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-[#94a3b8]" />
                        )}
                      </div>
                      <span className="text-[#e2e8f0]">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{c.phone || '-'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{c.email || '-'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{c.currentCompany || '-'}</td>
                  <td className="px-4 py-3 text-[#64748b] text-xs">
                    {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleRestore(c.id)}
                        disabled={actionLoading === c.id}
                        className="p-1.5 rounded-md text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors disabled:opacity-50"
                        title="恢复"
                      >
                        {actionLoading === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(c)}
                        disabled={actionLoading === c.id}
                        className="p-1.5 rounded-md text-[#ef4444] hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="永久删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#2a2d35] bg-[#1a1d24] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#e2e8f0]">确认永久删除</h3>
                <p className="text-sm text-[#94a3b8]">此操作不可撤销</p>
              </div>
            </div>

            <div className="rounded-lg border border-[#2a2d35] bg-[#0f1117] p-3 mb-4">
              <p className="text-sm text-[#e2e8f0]">
                将永久删除 <span className="font-semibold text-[#ef4444]">{confirmDelete.name}</span> 及其所有关联数据：
              </p>
              <ul className="mt-2 text-xs text-[#94a3b8] space-y-1">
                <li>• 职位流程记录</li>
                <li>• 跟进记录</li>
                <li>• 人脉关系</li>
                <li>• 简历文件</li>
                <li>• 作品集</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={actionLoading === confirmDelete.id}
                className="px-4 py-2 rounded-lg border border-[#2a2d35] text-[#e2e8f0] text-sm hover:bg-[#2a2d35] transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={actionLoading === confirmDelete.id}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === confirmDelete.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    确认删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
