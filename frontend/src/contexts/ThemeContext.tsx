import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from '../types/theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme') as Theme;
    console.log('Saved theme from localStorage:', savedTheme);
    if (savedTheme) {
      console.log('Using saved theme:', savedTheme);
      return savedTheme;
    }
    
    // Check system preference
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('System prefers dark mode:', systemDark);
    if (systemDark) {
      console.log('Using system preference: dark');
      return 'dark';
    }
    
    console.log('Using default: light');
    return 'light';
  });

  // Update document class and localStorage when theme changes
  useEffect(() => {
    console.log('Theme effect triggered, new theme:', theme);
    console.log('Current document classes before:', document.documentElement.className);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
    console.log('Current document classes after:', document.documentElement.className);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    console.log('toggleTheme called, current theme:', theme);
    setThemeState(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      console.log('Setting theme from', prevTheme, 'to', newTheme);
      return newTheme;
    });
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const value = {
    theme,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};