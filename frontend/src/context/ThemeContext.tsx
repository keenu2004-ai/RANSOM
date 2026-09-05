import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'vanilla' | 'merino';

export interface ThemeMeta {
  id: Theme;
  name: string;
  subtitle: string;
  description: string;
  palette: {
    bg: string;
    secondary: string;
    primary: string;
  };
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'vanilla',
    name: 'Vanilla',
    subtitle: 'Vanilla • Misty Sage • Bloodstone',
    description: 'Warm, elegant and sophisticated',
    palette: {
      bg: '#FFF9EB',
      secondary: '#9FB2AC',
      primary: '#5D0D18'
    }
  },
  {
    id: 'merino',
    name: 'Merino',
    subtitle: 'Merino • Rock Blue • Venice Blue',
    description: 'Calm, modern and professional',
    palette: {
      bg: '#F5EEDD',
      secondary: '#84B3CE',
      primary: '#16587B'
    }
  }
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  themes: ThemeMeta[];
  currentThemeMeta: ThemeMeta;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theiakshi_theme');
      if (saved === 'vanilla' || saved === 'merino') {
        return saved;
      }
    } catch {}
    return 'vanilla';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const cycleTheme = () => {
    setThemeState(prev => (prev === 'vanilla' ? 'merino' : 'vanilla'));
  };

  useEffect(() => {
    try {
      localStorage.setItem('theiakshi_theme', theme);
    } catch {}
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.remove('pastel', 'sage', 'neutral', 'dark', 'light');
    root.classList.add(theme);
  }, [theme]);

  const currentThemeMeta = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, themes: THEMES, currentThemeMeta }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'vanilla' as Theme,
      setTheme: () => {},
      cycleTheme: () => {},
      themes: THEMES,
      currentThemeMeta: THEMES[0]
    };
  }
  return context;
};
