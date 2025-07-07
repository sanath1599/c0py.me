import React from 'react';
import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { AppPage } from './pages/AppPage';
import { ClientLogPage } from './pages/ClientLogPage';
import { initAnalytics, trackPageView } from './utils/analytics';

type AppRoute = 'landing' | 'app' | 'client-log';

function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('landing');

  // Initialize analytics on app load
  useEffect(() => {
    initAnalytics();
  }, []);

  // Track page views when switching routes
  useEffect(() => {
    switch (currentRoute) {
      case 'landing':
        trackPageView('c0py.me - Landing Page');
        break;
      case 'app':
        trackPageView('c0py.me - File Sharing App');
        break;
      case 'client-log':
        trackPageView('c0py.me - Client Event Log');
        break;
    }
  }, [currentRoute]);

  const navigateTo = (route: AppRoute) => {
    setCurrentRoute(route);
  };

  switch (currentRoute) {
    case 'landing':
      return <LandingPage onGetStarted={() => navigateTo('app')} />;
    case 'client-log':
      return <ClientLogPage onBack={() => navigateTo('app')} />;
    case 'app':
    default:
      return <AppPage onNavigateToLog={() => navigateTo('client-log')} />;
  }
}

export default App;
