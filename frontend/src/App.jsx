import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage     from './pages/HomePage';
import DashboardPage   from './pages/DashboardPage';
import UploadPage      from './pages/UploadPage';
import LiveMonitorPage from './pages/LiveMonitorPage';
import AuditPage       from './pages/AuditPage';
import ReportsPage     from './pages/ReportsPage';
import DocumentIntelligencePage from './pages/DocumentIntelligencePage'; // Milestone 2
import AIAssistantPage from './pages/AIAssistantPage'; // Milestone 3
import IncidentsPage   from './pages/IncidentsPage';   // Milestone 3
import AlertsPage      from './pages/AlertsPage';      // Milestone 3

import './styles/index.css';

// ─── Authenticated shell ────────────────────────────────────────────────────
// Only rendered when the user IS authenticated.
// Wraps the existing Sidebar + Header + page content.
function AppLayout() {
  const [theme, setTheme] = useState(
    localStorage.getItem('safesight-theme') || 'light'
  );
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('safesight-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const getPageTitle = pathname => {
    switch (pathname) {
      case '/':            return 'Safety Overview';
      case '/dashboard':   return 'Analytics & Compliance Dashboard';
      case '/upload':      return 'Visual Upload & Inspection';
      case '/live-monitor':return 'Live Monitor & CCTV Stream';
      case '/audit':       return 'Events & Audit Log';
      case '/reports':     return 'Compliance PDF Reports';
      case '/documents':   return 'Document Intelligence & Knowledge Base';
      case '/assistant':   return 'Multimodal AI Assistant';
      case '/incidents':   return 'Incident Management';
      case '/alerts':      return 'Supervisor Safety Alerts';
      default:             return 'SafeSight AI';
    }
  };

  return (
    <div className="app-container">
      <Sidebar theme={theme} />
      <div className="main-wrapper">
        <Header
          pageTitle={getPageTitle(location.pathname)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="content-body">
          <Routes>
            <Route path="/"            element={<HomePage />} />
            <Route path="/dashboard"   element={<DashboardPage />} />
            <Route path="/upload"      element={<UploadPage />} />
            <Route path="/live-monitor"element={<LiveMonitorPage />} />
            <Route path="/audit"       element={<AuditPage />} />
            <Route path="/reports"     element={<ReportsPage />} />
            <Route path="/documents"   element={<DocumentIntelligencePage />} />
            <Route path="/assistant"   element={<AIAssistantPage />} />
            <Route path="/incidents"   element={<IncidentsPage />} />
            <Route path="/alerts"      element={<AlertsPage />} />
            {/* Any unknown path → home */}
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Root app ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public auth routes (no sidebar/header) ── */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── All other routes require authentication ── */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
