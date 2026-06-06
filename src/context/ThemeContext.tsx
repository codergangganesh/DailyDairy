import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'classic' | 'dark' | 'vintage' | 'dream' | 'minimal';

interface ThemeContextProps {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  isHandwritten: boolean;
  setIsHandwritten: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved theme and font preference from localStorage
  const [theme, setThemeState] = useState<ThemeType>(() => {
    return (localStorage.getItem('dreamvault_theme') as ThemeType) || 'classic';
  });
  
  const [isHandwritten, setIsHandwrittenState] = useState<boolean>(() => {
    return localStorage.getItem('dreamvault_handwritten') === 'true';
  });

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('dreamvault_theme', newTheme);
  };

  const setIsHandwritten = (val: boolean) => {
    setIsHandwrittenState(val);
    localStorage.setItem('dreamvault_handwritten', String(val));
  };

  useEffect(() => {
    // Apply theme class to document element for global CSS variables
    const root = document.documentElement;
    root.className = ''; // Reset classes
    root.classList.add(`theme-${theme}`);
    
    // Apply font style
    if (isHandwritten) {
      root.classList.add('font-handwritten');
    } else {
      root.classList.remove('font-handwritten');
    }
  }, [theme, isHandwritten]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isHandwritten, setIsHandwritten }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
