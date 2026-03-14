import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import RequirementsPage from "./pages/RequirementsPage";
import PrdPage from "./pages/PrdPage";
import RoadmapPage from "./pages/RoadmapPage";
import TeamPage from "./pages/TeamPage";
import KanbanPage from "./pages/KanbanPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ActivityPage from "./pages/ActivityPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AgentsInfoPage from "./pages/AgentsInfoPage";
import SettingsPage from "./pages/SettingsPage";
import MonitoringPage from "./pages/MonitoringPage";
import RiskDashboardPage from "./pages/RiskDashboardPage";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./routes/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/register" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/dashboard/:workspaceId" element={<DashboardLayout />}>
              <Route index element={<Navigate to="requirements" replace />} />
              <Route path="requirements" element={<RequirementsPage />} />
              <Route path="prd" element={<PrdPage />} />
              <Route path="roadmap" element={<RoadmapPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="kanban" element={<KanbanPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="agents-info" element={<AgentsInfoPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="risks" element={<RiskDashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
