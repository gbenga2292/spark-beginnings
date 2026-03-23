import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark';
export type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'violet' | 'slate';
export type UITheme = 'default' | 'modern' | 'glass' | 'brutalism' | 'minimalist' | 'burgundy' | 'midnight';

const MODE_KEY = 'dcel-theme';
const COLOR_KEY = 'dcel-color-theme';
const UI_KEY = 'dcel-ui-theme';

const ALL_COLOR_THEMES: ColorTheme[] = ['default', 'ocean', 'forest', 'sunset', 'rose', 'violet', 'slate'];
const ALL_UI_THEMES: UITheme[] = ['default', 'modern', 'glass', 'brutalism', 'minimalist', 'burgundy', 'midnight'];

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

function getInitialUI(): UITheme {
  try {
    const stored = localStorage.getItem(UI_KEY) as UITheme;
    if (ALL_UI_THEMES.includes(stored)) return stored;
  } catch {}
  return 'default';
}

// Singleton state shared across components
let _mode: Mode = getInitialMode();
let _color: ColorTheme = getInitialColor();
let _ui: UITheme = getInitialUI();
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

function applyUI(u: UITheme) {
  _ui = u;
  try { localStorage.setItem(UI_KEY, u); } catch {}
  ALL_UI_THEMES.forEach(t => document.documentElement.classList.remove(`ui-${t}`));
  if (u !== 'default') {
    document.documentElement.classList.add(`ui-${u}`);
  }
  _listeners.forEach(fn => fn());
}

// Apply immediately on load
applyMode(_mode);
applyColor(_color);
applyUI(_ui);

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
  const setUITheme = (u: UITheme) => applyUI(u);

  return {
    theme: _mode,
    colorTheme: _color,
    uiTheme: _ui,
    toggle,
    setLight,
    setDark,
    setColorTheme,
    setUITheme,
    isDark: _mode === 'dark',
  };
}

export { ALL_COLOR_THEMES, ALL_UI_THEMES };
