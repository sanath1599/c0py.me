import React from 'react';
import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { AppPage } from './pages/AppPage';
import { initAnalytics, trackPageView } from './utils/analytics';

function App() {
  const [showApp, setShowApp] = useState(false);

  // Initialize analytics on app load
  useEffect(() => {
    initAnalytics();
  }, []);

  // Track page views when switching between landing and app
  useEffect(() => {
    if (showApp) {
      trackPageView('c0py.me - File Sharing App');
    } else {
      trackPageView('c0py.me - Landing Page');
    }
  }, [showApp]);

  if (!showApp) {
    return <LandingPage onGetStarted={() => setShowApp(true)} />;
  }

  return (
    <AppPage />
  );
}

export default App;
