import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DiaryProvider } from './context/DiaryContext';
import { AuthPage } from './pages/AuthPage';
import { JournalPage } from './pages/JournalPage';
import { AdminPage } from './pages/AdminPage';
import { LandingPage } from './pages/LandingPage';
import { RefreshCw } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  // Show landing page until the user actively clicks "Get Started"
  const [showLanding, setShowLanding] = useState(() => {
    return window.location.pathname === '/' || window.location.pathname === '';
  });

  // Monitor location changes for custom routing
  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };
    
    // Listen to popstate
    window.addEventListener('popstate', handleLocationChange);
    
    // Monkey patch pushState to listen to programatic route changes
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center text-[var(--color-text-muted)] transition-colors duration-300">
        <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin mb-2" />
        <p className="text-xs font-semibold">Initializing DreamVault Shield...</p>
      </div>
    );
  }

  // Admin Portal Route
  if (path === '/admin') {
    return <AdminPage />;
  }

  // If already logged in, skip landing → go straight to the journal
  if (user) {
    return <JournalPage />;
  }

  // Show landing page for unauthenticated visitors
  if (showLanding) {
    return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  }

  return <AuthPage />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DiaryProvider>
          <MainAppContent />
        </DiaryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
