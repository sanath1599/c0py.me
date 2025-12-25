import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AppPage } from './pages/AppPage';
import { ClientLogPage } from './pages/ClientLogPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminLogin } from './pages/AdminLogin';
import { BackendLogsViewer } from './components/BackendLogsViewer';
import { initAnalytics, trackPageView } from './utils/analytics';

// Component to track page views
const PageTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    switch (path) {
      case '/':
        trackPageView('c0py.me - Landing Page');
        break;
      case '/app':
        trackPageView('c0py.me - File Sharing App');
        break;
      case '/admin':
        trackPageView('c0py.me - Admin Dashboard');
        break;
      case '/admin/login':
        trackPageView('c0py.me - Admin Login');
        break;
      case '/logs':
        trackPageView('c0py.me - Client Event Log');
        break;
      case '/admin/backend-logs':
        trackPageView('c0py.me - Backend Logs Viewer');
        break;
      default:
        trackPageView(`c0py.me - ${path}`);
    }
  }, [location]);

  return null;
};

function App() {
  // Initialize analytics on app load
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <Router>
      <PageTracker />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/backend-logs" element={<BackendLogsViewer />} />
        <Route path="/logs" element={<ClientLogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
