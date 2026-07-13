import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DiaryProvider } from './context/DiaryContext';
import { AuthPage } from './pages/AuthPage';
import { JournalPage } from './pages/JournalPage';
import { LandingPage } from './pages/LandingPage';
import { RefreshCw } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  // Show landing page until the user actively clicks "Get Started"
  const [showLanding, setShowLanding] = useState(() => {
    return window.location.pathname === '/' || window.location.pathname === '';
  });

  // When user signs out (user goes from truthy → null), redirect back to landing page
  const prevUserRef = React.useRef(user);
  useEffect(() => {
    if (prevUserRef.current !== null && user === null && !isLoading) {
      setShowLanding(true);
    }
    prevUserRef.current = user;
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center text-[var(--color-text-muted)] transition-colors duration-300">
        <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin mb-2" />
        <p className="text-xs font-semibold">Initializing DreamVault Shield...</p>
      </div>
    );
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
