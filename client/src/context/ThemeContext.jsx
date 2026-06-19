import { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  {
    id: 'ocean',
    name: 'Ocean & Navy',
    description: 'School navy and red (default)',
    preview: ['#152a5e', '#c41e3a', '#f9fafb'],
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Easier on the eyes in low light',
    preview: ['#1e293b', '#3b82f6', '#0f172a'],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Calm green accents',
    preview: ['#14532d', '#22c55e', '#f0fdf4'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm burgundy and gold',
    preview: ['#7c2d12', '#ea580c', '#fff7ed'],
  },
];

const STORAGE_KEY = 'toks-theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'ocean';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
