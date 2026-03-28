// context/ThemeContext.js
// Manages dark / light mode. Applies data-theme to <body>.
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('sentinel_theme') || 'dark'
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('sentinel_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be within <ThemeProvider>');
  return ctx;
}

export default ThemeContext;
