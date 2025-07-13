import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AppPage } from './pages/AppPage';
import { ClientLogPage } from './pages/ClientLogPage';
import { AdminDashboard } from './pages/AdminDashboard';
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
      case '/logs':
        trackPageView('c0py.me - Client Event Log');
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
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/logs" element={<ClientLogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
