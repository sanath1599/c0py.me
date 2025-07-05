import React from 'react';
import { useState } from 'react';
import { LandingPage } from './pages/LandingPage';
import { AppPage } from './pages/AppPage';

function App() {
  const [showApp, setShowApp] = useState(false);

  if (!showApp) {
    return <LandingPage onGetStarted={() => setShowApp(true)} />;
  }

  return (
    <AppPage />
  );
}

export default App;
