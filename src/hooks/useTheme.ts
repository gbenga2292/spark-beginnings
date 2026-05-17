import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark';
export type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'violet' | 'slate' | 'burgundy' | 'midnight' | 'monokai' | 'solarized' | 'tokyo-night';
export type UITheme = 'default' | 'modern' | 'glass' | 'brutalism' | 'minimalist';

const MODE_KEY = 'dcel-theme';
const COLOR_KEY = 'dcel-color-theme';
const UI_KEY = 'dcel-ui-theme';
const CALENDAR_KEY = 'dcel-floating-calendar';

const ALL_COLOR_THEMES: ColorTheme[] = ['default', 'ocean', 'forest', 'sunset', 'rose', 'violet', 'slate', 'burgundy', 'midnight', 'monokai', 'solarized', 'tokyo-night'];
const ALL_UI_THEMES: UITheme[] = ['default', 'modern', 'glass', 'brutalism', 'minimalist'];
export const IDE_THEMES: ColorTheme[] = ['burgundy', 'midnight', 'monokai', 'solarized', 'tokyo-night'];

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

function getInitialCalendar(): boolean {
  try {
    const stored = localStorage.getItem(CALENDAR_KEY);
    if (stored === 'false') return false;
  } catch {}
  return true;
}

// Singleton state shared across components
let _mode: Mode = getInitialMode();
let _color: ColorTheme = getInitialColor();
let _ui: UITheme = getInitialUI();
let _showCalendar: boolean = getInitialCalendar();
const _listeners = new Set<() => void>();

function updateHtmlClasses() {
  ALL_COLOR_THEMES.forEach(t => document.documentElement.classList.remove(`theme-${t}`));
  if (_color !== 'default') {
    document.documentElement.classList.add(`theme-${_color}`);
  }
  
  if (_mode === 'dark' || IDE_THEMES.includes(_color)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  ALL_UI_THEMES.forEach(t => document.documentElement.classList.remove(`ui-${t}`));
  if (_ui !== 'default') {
    document.documentElement.classList.add(`ui-${_ui}`);
  }
}

function applyMode(m: Mode) {
  _mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch {}
  updateHtmlClasses();
  _listeners.forEach(fn => fn());
}

function applyColor(c: ColorTheme) {
  _color = c;
  try { localStorage.setItem(COLOR_KEY, c); } catch {}
  updateHtmlClasses();
  _listeners.forEach(fn => fn());
}

function applyUI(u: UITheme) {
  _ui = u;
  try { localStorage.setItem(UI_KEY, u); } catch {}
  updateHtmlClasses();
  _listeners.forEach(fn => fn());
}

function applyCalendar(show: boolean) {
  _showCalendar = show;
  try { localStorage.setItem(CALENDAR_KEY, String(show)); } catch {}
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
  const setShowFloatingCalendar = (show: boolean) => applyCalendar(show);

  return {
    theme: _mode,
    colorTheme: _color,
    uiTheme: _ui,
    showFloatingCalendar: _showCalendar,
    toggle,
    setLight,
    setDark,
    setColorTheme,
    setUITheme,
    setShowFloatingCalendar,
    isDark: _mode === 'dark' || IDE_THEMES.includes(_color),
  };
}

export { ALL_COLOR_THEMES, ALL_UI_THEMES };
