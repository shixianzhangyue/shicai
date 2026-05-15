import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import Sidebar from "./Sidebar";
import { QuickRecord } from "@/components/candidates/QuickRecord";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

// Map pathname segments to Chinese labels for breadcrumbs
const pathLabelMap: Record<string, string> = {
  dashboard: "仪表盘",
  jobs: "职位管理",
  "talent-pool": "人才库",
  settings: "设置",
};

function PageLayout({ children, title, description }: PageLayoutProps) {
  const location = useLocation();
  const [quickRecordOpen, setQuickRecordOpen] = useState(false);
  const pathSegments = location.pathname
    .split("/")
    .filter((s) => s.length > 0);

  // Global keyboard shortcut: Ctrl+Shift+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setQuickRecordOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Breadcrumb + Title header */}
        <header className="shrink-0 h-14 px-6 flex items-center border-b border-[#2a2d35] bg-[#0f1117]">
          <nav className="flex items-center gap-1.5 text-sm">
            <Link
              to="/dashboard"
              className="flex items-center gap-1 text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
            >
              <Home className="w-4 h-4" />
            </Link>
            {pathSegments.map((segment, index) => {
              const isLast = index === pathSegments.length - 1;
              const path = "/" + pathSegments.slice(0, index + 1).join("/");
              const label = pathLabelMap[segment] || segment;
              return (
                <div key={segment} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-[#2a2d35]" />
                  {isLast ? (
                    <span className="text-[#e2e8f0] font-medium">{label}</span>
                  ) : (
                    <Link
                      to={path}
                      className="text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
                    >
                      {label}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
        </header>

        {/* Page title area */}
        {(title || description) && (
          <div className="shrink-0 px-6 py-5 border-b border-[#2a2d35]">
            {title && (
              <h1 className="text-xl font-semibold text-[#e2e8f0]">{title}</h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-[#94a3b8]">{description}</p>
            )}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>

      {/* QuickRecord overlay */}
      <QuickRecord open={quickRecordOpen} onClose={() => setQuickRecordOpen(false)} />
    </div>
  );
}

export default PageLayout;
