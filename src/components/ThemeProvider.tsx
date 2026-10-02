"use client";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";
let sessionTheme: Theme | null = null;

function getTheme(): Theme {
  try {
    const stored = localStorage.getItem('cw-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* Theme switching still works when storage is unavailable. */ }
  return sessionTheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function subscribe(onChange: () => void) {
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', onChange);
  window.addEventListener('cw-theme-change', onChange);
  preference.addEventListener('change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('cw-theme-change', onChange);
    preference.removeEventListener('change', onChange);
  };
}

const serverTheme = (): Theme => 'light';

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, serverTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    sessionTheme = next;
    try { localStorage.setItem("cw-theme", next); } catch { /* Use session preference. */ }
    window.dispatchEvent(new Event('cw-theme-change'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
