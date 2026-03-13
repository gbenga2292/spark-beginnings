import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark';
export type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'violet' | 'slate';

const MODE_KEY = 'dcel-theme';
const COLOR_KEY = 'dcel-color-theme';

const ALL_COLOR_THEMES: ColorTheme[] = ['default', 'ocean', 'forest', 'sunset', 'rose', 'violet', 'slate'];

function getInitialMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialColor(): ColorTheme {
  try {
    const stored = localStorage.getItem(COLOR_KEY) as ColorTheme;
    if (ALL_COLOR_THEMES.includes(stored)) return stored;
  } catch {}
  return 'default';
}

// Singleton state shared across components
let _mode: Mode = getInitialMode();
let _color: ColorTheme = getInitialColor();
const _listeners = new Set<() => void>();

function applyMode(m: Mode) {
  _mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch {}
  if (m === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  _listeners.forEach(fn => fn());
}

function applyColor(c: ColorTheme) {
  _color = c;
  try { localStorage.setItem(COLOR_KEY, c); } catch {}
  // Remove all theme classes, then add the active one
  ALL_COLOR_THEMES.forEach(t => document.documentElement.classList.remove(`theme-${t}`));
  if (c !== 'default') {
    document.documentElement.classList.add(`theme-${c}`);
  }
  _listeners.forEach(fn => fn());
}

// Apply immediately on load
applyMode(_mode);
applyColor(_color);

export function useTheme() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender(n => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const toggle = () => applyMode(_mode === 'dark' ? 'light' : 'dark');
  const setLight = () => applyMode('light');
  const setDark = () => applyMode('dark');
  const setColorTheme = (c: ColorTheme) => applyColor(c);

  return {
    theme: _mode,
    colorTheme: _color,
    toggle,
    setLight,
    setDark,
    setColorTheme,
    isDark: _mode === 'dark',
  };
}

export { ALL_COLOR_THEMES };
