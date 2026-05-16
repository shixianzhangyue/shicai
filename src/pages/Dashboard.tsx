import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { api } from '@/lib/api';
import type { OverviewStats, FunnelData, Job } from '@/types';
import ReactECharts from 'echarts-for-react';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Briefcase,
  Loader2,
  Target,
  CheckCircle,
} from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingStats(true);
    setLoadingFunnel(true);
    setError('');

    Promise.all([
      api.stats.overview(),
      api.stats.funnel(),
      api.jobs.list(),
    ])
      .then(([overview, funnel, jobList]) => {
        if (cancelled) return;
        setStats(overview);
        setFunnelData(funnel);
        setJobs(jobList.filter((j) => j.status !== 'closed'));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStats(false);
          setLoadingFunnel(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingFunnel(true);
    api.stats
      .funnel(selectedJobId || undefined)
      .then((data) => {
        if (!cancelled) setFunnelData(data);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFunnel(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  const chartOption = useMemo(() => {
    if (funnelData.length === 0) {
      return null;
    }

    const jobNames = Array.from(new Set(funnelData.map((d) => d.jobTitle)));
    const stageNames = Array.from(new Set(funnelData.map((d) => d.stageName)));

    const series = stageNames.map((stageName) => ({
      name: stageName,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      data: jobNames.map((jobName) => {
        const item = funnelData.find(
          (d) => d.jobTitle === jobName && d.stageName === stageName
        );
        return item?.count ?? 0;
      }),
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1a1d24',
        borderColor: '#2a2d35',
        textStyle: { color: '#e2e8f0' },
      },
      legend: {
        textStyle: { color: '#e2e8f0' },
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: jobNames,
        axisLabel: {
          color: '#e2e8f0',
          interval: 0,
          rotate: jobNames.length > 5 ? 30 : 0,
        },
        axisLine: { lineStyle: { color: '#2a2d35' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#e2e8f0' },
        splitLine: { lineStyle: { color: '#2a2d35' } },
      },
      series,
    };
  }, [funnelData]);

  return (
    <PageLayout
      title="仪表盘"
      description="查看招聘工作的整体概况和关键指标"
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Briefcase}
          label="在招职位"
          value={loadingStats ? '...' : String(stats?.openJobs ?? 0)}
          color="text-blue-400"
          onClick={() => navigate('/jobs?status=open')}
          loading={loadingStats}
        />
        <StatCard
          icon={Target}
          label="需求人数"
          value={loadingStats ? '...' : String(stats?.totalHeadcount ?? 0)}
          color="text-purple-400"
          loading={loadingStats}
        />
        <StatCard
          icon={Users}
          label="候选人总数"
          value={loadingStats ? '...' : String(stats?.totalCandidates ?? 0)}
          color="text-emerald-400"
          onClick={() => navigate('/talent-pool')}
          loading={loadingStats}
        />
        <StatCard
          icon={Users}
          label="人才库"
          value={loadingStats ? '...' : String(stats?.talentPoolSize ?? 0)}
          color="text-amber-400"
          onClick={() => navigate('/talent-pool?mode=talent-pool')}
          loading={loadingStats}
        />
        <StatCard
          icon={BarChart3}
          label="今日待跟进"
          value={loadingStats ? '...' : String(stats?.todayFollowUps ?? 0)}
          color="text-red-400"
          onClick={() => navigate('/candidates')}
          loading={loadingStats}
        />
        <StatCard
          icon={CheckCircle}
          label="已入职"
          value={loadingStats ? '...' : String(stats?.hiredCount ?? 0)}
          color="text-green-400"
          loading={loadingStats}
        />
      </div>

      {/* Chart Area */}
      <div className="rounded-xl bg-[#1a1d24] border border-[#2a2d35] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h2 className="text-base font-medium text-[#e2e8f0]">
            招聘漏斗
          </h2>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="h-9 w-full sm:w-56 rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-1.5 text-sm text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
          >
            <option value="">全部职位</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>

        {loadingFunnel ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
            <span className="ml-3 text-sm text-[#94a3b8]">加载中...</span>
          </div>
        ) : chartOption ? (
          <ReactECharts
            option={chartOption}
            style={{ height: 360 }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutDashboard className="w-10 h-10 mb-3 text-[#64748b]" />
            <p className="text-sm text-[#94a3b8]">
              {jobs.length === 0
                ? '暂无职位数据，去创建第一个职位'
                : '暂无候选人数据'}
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  onClick?: () => void;
  loading?: boolean;
}

function StatCard({ icon: Icon, label, value, color, onClick, loading }: StatCardProps) {
  return (
    <div
      className={`p-4 rounded-xl bg-[#1a1d24] border border-[#2a2d35] ${
        onClick ? 'cursor-pointer hover:border-[#3b82f6]/30 transition-colors' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-[#e2e8f0]">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
        ) : (
          value
        )}
      </div>
      <div className="text-xs text-[#94a3b8] mt-1">{label}</div>
    </div>
  );
}

export default Dashboard;
