import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toaster } from "./components/ui/Toaster";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";
import PageLayout from "./components/layout/PageLayout";

// Code splitting: lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Candidates = lazy(() => import("./pages/Candidates"));
const TalentPool = lazy(() => import("./pages/TalentPool"));
const RecycleBin = lazy(() => import("./pages/RecycleBin"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoader() {
  return (
    <PageLayout>
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    </PageLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/talent-pool" element={<TalentPool />} />
            <Route path="/recycle-bin" element={<RecycleBin />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
      <ConfirmDialog />
    </ErrorBoundary>
  );
}

export default App;
