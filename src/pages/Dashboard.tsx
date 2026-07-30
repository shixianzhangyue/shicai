import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { api } from '@/lib/api';
import type { OverviewStats, FunnelData, Job, RecentActivity, TrendData } from '@/types';
import {
  LayoutDashboard, BarChart3, Users, Briefcase, Loader2, Target, CheckCircle,
  Plus, FileText, Clock, TrendingUp, ArrowUpRight, ChevronDown,
  UserPlus, UserMinus, XCircle, Archive,
} from 'lucide-react';

// Funnel component - CSS-based with percentage and conversion rates
function FunnelChart({ data, onStageClick }: { data: { name: string; count: number }[]; onStageClick: (stageName: string) => void }) {
  if (data.length === 0) return null;

  const maxCount = data[0]?.count || 1;
  const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa'];

  return (
    <div className="w-full">
      {data.map((item, i) => {
        const ratio = item.count / maxCount;
        const percentage = Math.round(ratio * 100);
        const conversionRate = i > 0 ? Math.round((item.count / data[i - 1].count) * 100) : 100;
        const color = colors[i % colors.length];

        return (
          <div key={item.name}>
            {/* Funnel stage */}
            <div 
              className="flex items-center mb-1 cursor-pointer hover:opacity-85 transition-opacity"
              onClick={() => onStageClick(item.name)}
            >
              <div 
                className="h-[60px] rounded flex flex-col items-center justify-center text-white transition-all duration-300"
                style={{ width: `${percentage}%`, backgroundColor: color }}
              >
                <span className="text-[13px] font-medium mb-0.5">{item.name}</span>
                <span className="text-[11px] opacity-80">{item.count} 人</span>
              </div>
              <span className="w-[50px] text-left ml-3 text-[11px] text-[#94a3b8]">{percentage}%</span>
            </div>

            {/* Conversion rate between stages */}
            {i < data.length - 1 && (
              <div className="flex justify-end mr-[62px] mb-1">
                <span className="text-[10px] text-[#64748b]">
                  ↓ {Math.round((data[i + 1].count / item.count) * 100)}% 转化
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Helper function to get icon and color based on activity type
function getActivityIcon(type: string) {
  switch (type) {
    case 'join':
      return {
        icon: <UserPlus className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />,
        bg: 'rgba(59, 130, 246, 0.15)',
      };
    case 'leave':
      return {
        icon: <UserMinus className="w-3.5 h-3.5" style={{ color: '#64748b' }} />,
        bg: 'rgba(100, 116, 139, 0.15)',
      };
    case 'reject':
      return {
        icon: <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />,
        bg: 'rgba(239, 68, 68, 0.15)',
      };
    case 'pool':
      return {
        icon: <Archive className="w-3.5 h-3.5" style={{ color: '#10b981' }} />,
        bg: 'rgba(16, 185, 129, 0.15)',
      };
    default:
      return {
        icon: <Clock className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />,
        bg: 'rgba(245, 158, 11, 0.15)',
      };
  }
}

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

// Activity item component
function ActivityItem({ icon, iconBg, title, description, time }: { 
  icon: React.ReactNode; 
  iconBg: string; 
  title: string; 
  description: string; 
  time: string 
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0`} style={{ backgroundColor: iconBg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#e2e8f0]">{title}</div>
        <div className="text-[11px] text-[#64748b] mt-0.5 truncate">{description}</div>
        <div className="text-[10px] text-[#4a5568] mt-0.5">{time}</div>
      </div>
    </div>
  );
}

// Stat Card with trend indicator
function StatCardWithTrend({ 
  icon, 
  iconBg, 
  iconColor, 
  label, 
  value, 
  trend, 
  trendValue, 
  onClick, 
  loading 
}: { 
  icon: React.ReactNode; 
  iconBg: string; 
  iconColor: string; 
  label: string; 
  value: string; 
  trend?: 'up' | 'down'; 
  trendValue?: string; 
  onClick?: () => void; 
  loading?: boolean 
}) {
  return (
    <div
      className={`p-5 rounded-xl bg-[#1a1d24] border border-[#2a2d35] ${onClick ? 'cursor-pointer hover:border-[#3b82f6]/30 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
          {icon}
        </div>
        {trend && trendValue && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'text-[#10b981] bg-[#10b981]/10' : 'text-[#ef4444] bg-[#ef4444]/10'
          }`}>
            {trend === 'up' ? '+' : ''}{trendValue}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-[#e2e8f0]">
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" /> : value}
      </div>
      <div className="text-xs text-[#94a3b8] mt-1">{label}</div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingStats(true);
    setLoadingFunnel(true);
    setLoadingActivity(true);
    setError('');

    Promise.all([
      api.stats.overview(),
      api.stats.funnel(),
      api.jobs.list(),
      api.stats.recentActivity(5),
      api.stats.trendData().catch(() => null),
    ])
      .then(([overview, funnel, jobList, activity, trend]) => {
        if (cancelled) return;
        setStats(overview);
        setFunnelData(funnel);
        setJobs(jobList.filter((j) => j.status !== 'closed'));
        setRecentActivity(activity);
        setTrendData(trend);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStats(false);
          setLoadingFunnel(false);
          setLoadingActivity(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingFunnel(true);
    api.stats
      .funnel(selectedJobId || undefined)
      .then((data) => { if (!cancelled) setFunnelData(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (!cancelled) setLoadingFunnel(false); });
    return () => { cancelled = true; };
  }, [selectedJobId]);

  const aggregatedFunnel = useMemo(() => {
    if (funnelData.length === 0) return [];
    const stageMap = new Map<string, number>();
    funnelData.forEach((d) => {
      stageMap.set(d.stageName, (stageMap.get(d.stageName) || 0) + d.count);
    });
    const stageOrder = ['简历筛选', '面试', 'Offer沟通', '已入职'];
    return stageOrder
      .filter((s) => stageMap.has(s))
      .map((s) => ({ name: s, count: stageMap.get(s)! }));
  }, [funnelData]);

  const calcTrend = (thisWeek: number, lastWeek: number): { direction: 'up' | 'down'; value: string } => {
    if (!trendData) return { direction: 'up', value: '0%' };
    const pct = ((thisWeek - lastWeek) / Math.max(lastWeek, 1)) * 100;
    return {
      direction: pct >= 0 ? 'up' : 'down',
      value: `${Math.abs(Math.round(pct))}%`,
    };
  };

  const candidateTrend = calcTrend(trendData?.candidatesThisWeek ?? 0, trendData?.candidatesLastWeek ?? 0);
  const hiredTrend = calcTrend(trendData?.hiredThisWeek ?? 0, trendData?.hiredLastWeek ?? 0);

  const handleStageClick = (stageName: string) => {
    const params = new URLSearchParams();
    if (selectedJobId) params.set('jobId', selectedJobId);
    params.set('stage', stageName);
    navigate(`/candidates?${params.toString()}`);
  };

  return (
    <PageLayout title="仪表盘" description="查看招聘工作的整体概况和关键指标">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCardWithTrend
          icon={<Briefcase className="w-5 h-5" style={{ color: '#3b82f6' }} />}
          iconBg="rgba(59, 130, 246, 0.15)"
          iconColor="#3b82f6"
          label="在招职位"
          value={loadingStats ? '...' : String(stats?.openJobs ?? 0)}
          onClick={() => navigate('/jobs?status=open')}
          loading={loadingStats}
        />
        <StatCardWithTrend
          icon={<Users className="w-5 h-5" style={{ color: '#8b5cf6' }} />}
          iconBg="rgba(139, 92, 246, 0.15)"
          iconColor="#8b5cf6"
          label="候选人总数"
          value={loadingStats ? '...' : String(stats?.totalCandidates ?? 0)}
          trend={candidateTrend.direction}
          trendValue={candidateTrend.value}
          onClick={() => navigate('/talent-pool')}
          loading={loadingStats}
        />
        <StatCardWithTrend
          icon={<Target className="w-5 h-5" style={{ color: '#f59e0b' }} />}
          iconBg="rgba(245, 158, 11, 0.15)"
          iconColor="#f59e0b"
          label="需求人数"
          value={loadingStats ? '...' : String(stats?.totalHeadcount ?? 0)}
          loading={loadingStats}
        />
        <StatCardWithTrend
          icon={<CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />}
          iconBg="rgba(16, 185, 129, 0.15)"
          iconColor="#10b981"
          label="已入职"
          value={loadingStats ? '...' : String(stats?.hiredCount ?? 0)}
          trend={hiredTrend.direction}
          trendValue={hiredTrend.value}
          loading={loadingStats}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Chart - 2/3 width */}
        <div className="lg:col-span-2 rounded-xl bg-[#1a1d24] border border-[#2a2d35] p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-[#e2e8f0]">招聘漏斗</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="h-8 px-3 rounded-md border border-[#2a2d35] bg-[#0f1117] text-xs text-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
              >
                <option value="">全部职位</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingFunnel ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
              <span className="ml-2 text-xs text-[#94a3b8]">加载中...</span>
            </div>
          ) : aggregatedFunnel.length > 0 ? (
            <div>
              <FunnelChart data={aggregatedFunnel} onStageClick={handleStageClick} />
              <p className="text-center text-[10px] text-[#64748b] mt-4">点击漏斗层跳转到候选人列表</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <LayoutDashboard className="w-8 h-8 mb-2 text-[#64748b]" />
              <p className="text-xs text-[#94a3b8]">
                {jobs.length === 0 ? '暂无职位数据' : '暂无候选人数据'}
              </p>
            </div>
          )}
        </div>

        {/* Right Panel - 1/3 width */}
        <div className="flex flex-col gap-5">
          {/* Recent Activity */}
          <div className="rounded-xl bg-[#1a1d24] border border-[#2a2d35] p-5">
            <h3 className="text-sm font-medium text-[#e2e8f0] mb-4">最近动态</h3>
            {loadingActivity ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#3b82f6]" />
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentActivity.map((item) => {
                  const iconConfig = getActivityIcon(item.activityType);
                  return (
                    <ActivityItem
                      key={item.id}
                      icon={iconConfig.icon}
                      iconBg={iconConfig.bg}
                      title={item.title}
                      description={item.description}
                      time={formatTimeAgo(item.createdAt)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#64748b] text-center py-4">暂无最近动态</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl bg-[#1a1d24] border border-[#2a2d35] p-5">
            <h3 className="text-sm font-medium text-[#e2e8f0] mb-3">快捷操作</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/talent-pool')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#0f1117] border border-[#2a2d35] text-xs text-[#e2e8f0] hover:border-[#3b82f6]/30 transition-colors text-left"
              >
                <Plus className="w-4 h-4" style={{ color: '#3b82f6' }} />
                添加候选人
              </button>
              <button
                onClick={() => navigate('/jobs')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#0f1117] border border-[#2a2d35] text-xs text-[#e2e8f0] hover:border-[#3b82f6]/30 transition-colors text-left"
              >
                <FileText className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                创建职位
              </button>
              <button
                onClick={() => navigate('/candidates')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#0f1117] border border-[#2a2d35] text-xs text-[#e2e8f0] hover:border-[#3b82f6]/30 transition-colors text-left"
              >
                <Users className="w-4 h-4" style={{ color: '#10b981' }} />
                查看全部候选人
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default Dashboard;
