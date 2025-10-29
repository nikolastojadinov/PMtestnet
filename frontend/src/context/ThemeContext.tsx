import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'pm_theme_v1';

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemDark, setSystemDark] = useState<boolean>(false);

  // Load initial theme and system preference
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeState(saved);
      }
    } catch {}
    setSystemDark(getSystemPrefersDark());
  }, []);

  // Watch system changes when theme=system
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    try {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      // Safari fallback
      mql.addListener(onChange as any);
      return () => mql.removeListener(onChange as any);
    }
  }, []);

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') return systemDark ? 'dark' : 'light';
    return theme;
  }, [theme, systemDark]);

  // Apply class to <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (resolvedTheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [resolvedTheme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
