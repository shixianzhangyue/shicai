import { useState, useEffect } from "react";
import {
  Briefcase,
  Users,
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  FileText,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { TodayFollowUpsPanel } from "./TodayFollowUpsPanel";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { path: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { path: "/jobs", label: "职位管理", icon: Briefcase },
  { path: "/job-templates", label: "职位模板", icon: FileText },
  { path: "/candidates", label: "候选人", icon: Users },
  { path: "/talent-pool", label: "人才库", icon: Users },
  { path: "/settings", label: "设置", icon: Settings },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const location = useLocation();

  const sidebarWidth = collapsed ? "w-16" : "w-[240px]";

  // Fetch follow-up count from backend
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const followUps = await api.followUps.getToday();
        setFollowUpCount(followUps.length);
      } catch (err) {
        console.error("Failed to fetch follow-up count:", err);
      }
    };
    fetchCount();
    // Refresh every 5 minutes
    const interval = setInterval(fetchCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <aside
        className={`${sidebarWidth} flex flex-col shrink-0 transition-all duration-300 ease-in-out bg-[#0f1117] border-r border-[#2a2d35]`}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#2a2d35]">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#3b82f6] flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold text-[#e2e8f0]">
                TalentVault
              </span>
            </div>
          )}
          {collapsed && (
            <div className="w-7 h-7 rounded-md bg-[#3b82f6] flex items-center justify-center mx-auto">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-md hover:bg-[#1a1d24] text-[#94a3b8] transition-colors"
              title="收起侧边栏"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle (when collapsed, shown at top) */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center h-10 hover:bg-[#1a1d24] text-[#94a3b8] transition-colors border-b border-[#2a2d35]"
            title="展开侧边栏"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#3b82f6]/15 text-[#3b82f6]"
                    : "text-[#94a3b8] hover:bg-[#1a1d24] hover:text-[#e2e8f0]"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom section: follow-ups badge */}
        <div className="p-3 border-t border-[#2a2d35]">
          <button
            onClick={() => setPanelOpen(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1a1d24] hover:bg-[#2a2d35] transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="relative shrink-0">
              <Bell className="w-5 h-5 text-[#94a3b8]" />
              {followUpCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {followUpCount > 99 ? "99+" : followUpCount}
                </span>
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs text-[#94a3b8]">今日待跟进</span>
                <span className="text-sm font-semibold text-[#e2e8f0]">
                  {followUpCount} 人
                </span>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Today Follow-ups Panel */}
      <TodayFollowUpsPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}

export default Sidebar;
