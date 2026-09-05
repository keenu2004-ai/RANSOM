import React, { createContext, useContext, useEffect } from 'react';

export interface ThemeMeta {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  palette: {
    bg: string;
    secondary: string;
    primary: string;
    accent: string;
    destructive: string;
  };
}

export const THEME_PALETTE: ThemeMeta = {
  id: 'theiakshi',
  name: 'Theiakshi HRMS',
  subtitle: 'Soft Green • Mint • Deep Green • Rose • Burgundy',
  description: 'A calm workspace for a more productive tomorrow',
  palette: {
    bg: '#CAEBC7',
    secondary: '#C7EBDD',
    primary: '#306B55',
    accent: '#EAC7C7',
    destructive: '#6B3030'
  }
};

interface ThemeContextType {
  theme: string;
  currentThemeMeta: ThemeMeta;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'theiakshi',
  currentThemeMeta: THEME_PALETTE
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'theiakshi');
    root.classList.remove('vanilla', 'merino', 'pastel', 'sage', 'neutral', 'dark', 'light');
    root.classList.add('theiakshi');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'theiakshi', currentThemeMeta: THEME_PALETTE }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext);
};
