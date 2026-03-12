import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const KEY = 'dcel-theme';

function getInitial(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Singleton state shared across components
let _theme: Theme = getInitial();
const _listeners = new Set<(t: Theme) => void>();

function applyTheme(t: Theme) {
  _theme = t;
  try { localStorage.setItem(KEY, t); } catch {}
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  _listeners.forEach(fn => fn(t));
}

// Apply immediately on load
applyTheme(_theme);

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(_theme);

  useEffect(() => {
    _listeners.add(setTheme);
    return () => { _listeners.delete(setTheme); };
  }, []);

  const toggle = () => applyTheme(_theme === 'dark' ? 'light' : 'dark');
  const setLight = () => applyTheme('light');
  const setDark = () => applyTheme('dark');

  return { theme, toggle, setLight, setDark, isDark: theme === 'dark' };
}
