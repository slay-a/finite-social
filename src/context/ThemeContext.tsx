import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeId, THEMES, DEFAULT_THEME } from '../theme/themes';

const THEME_KEY = 'finitesocial:theme';

interface ThemeContextValue {
  theme: Theme;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: DEFAULT_THEME, setThemeId: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved) {
        const found = THEMES.find((t) => t.id === saved);
        if (found) setTheme(found);
      }
    });
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    const found = THEMES.find((t) => t.id === id);
    if (!found) return;
    setTheme(found);
    AsyncStorage.setItem(THEME_KEY, id);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeControls() {
  const ctx = useContext(ThemeContext);
  return { theme: ctx.theme, setThemeId: ctx.setThemeId };
}
