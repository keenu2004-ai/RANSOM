import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'pastel' | 'sage' | 'neutral';

export interface ThemeMeta {
  id: Theme;
  name: string;
  description: string;
  swatch: {
    bg: string;
    surface: string;
    primary: string;
  };
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'pastel',
    name: 'Pastel',
    description: 'Soft, modern and elegant',
    swatch: {
      bg: '#FBF7F2',
      surface: '#FFFDFC',
      primary: '#D47A74'
    }
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Natural, fresh and balanced',
    swatch: {
      bg: '#F5F7F4',
      surface: '#FCFDFB',
      primary: '#5A7D65'
    }
  },
  {
    id: 'neutral',
    name: 'Neutral',
    description: 'Professional and timeless',
    swatch: {
      bg: '#F7F5F0',
      surface: '#FEFDFC',
      primary: '#8D7B68'
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
      if (saved === 'pastel' || saved === 'sage' || saved === 'neutral') {
        return saved;
      }
    } catch {}
    return 'pastel';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const cycleTheme = () => {
    setThemeState(prev => {
      if (prev === 'pastel') return 'sage';
      if (prev === 'sage') return 'neutral';
      return 'pastel';
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem('theiakshi_theme', theme);
    } catch {}
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.remove('dark', 'light');
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
      theme: 'pastel' as Theme,
      setTheme: () => {},
      cycleTheme: () => {},
      themes: THEMES,
      currentThemeMeta: THEMES[0]
    };
  }
  return context;
};
