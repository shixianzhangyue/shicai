import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import TalentPool from "./pages/TalentPool";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jobs" element={<Jobs />} />
        {/* Redirect /candidates to /talent-pool */}
        <Route path="/candidates" element={<Navigate to="/talent-pool" replace />} />
        <Route path="/talent-pool" element={<TalentPool />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
