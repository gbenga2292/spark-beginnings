import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { useUserStore } from '@/src/store/userStore';
import { useNavigate as useRRNavigate } from 'react-router-dom';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      showMenu: (id: string, x: number, y: number) => void;
      getVersion: () => Promise<string>;
      checkForUpdates: () => void;
      setTitleBarOverlay: (opts: { color: string; symbolColor: string; height: number }) => void;
      updateMenuPrivileges: (privs: Record<string, any> | null) => void;
    };
  }
}

const MENU_ITEMS = [
  { id: 'file',     label: 'File' },
  { id: 'navigate', label: 'Navigate' },
  { id: 'view',     label: 'View' },
  { id: 'help',     label: 'Help' },
];

export function TitleBar() {
  const isElectron = window.electronAPI?.isElectron;
  const isMac = window.electronAPI?.platform === 'darwin';
  const [version, setVersion] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { isDark, toggle } = useTheme();
  const currentUser = useUserStore((s) => s.getCurrentUser());

  // React Router navigate is unavailable here (TitleBar is outside BrowserRouter)
  // So we post a custom DOM event that Layout/App listens for instead.
  const dispatchNav = (path: string) => {
    window.dispatchEvent(new CustomEvent('electron-navigate', { detail: path }));
  };

  useEffect(() => {
    window.electronAPI?.getVersion().then(v => setVersion(v)).catch(() => {});
  }, []);

  // Push current user privileges to main so Navigate menu reflects access
  useEffect(() => {
    if (!window.electronAPI?.updateMenuPrivileges) return;
    window.electronAPI.updateMenuPrivileges(
      currentUser ? currentUser.privileges : null
    );
  }, [currentUser]);

  // Listen for navigate events from main process menu clicks
  useEffect(() => {
    const handler = (e: CustomEvent) => dispatchNav(e.detail);
    window.addEventListener('electron-navigate', handler as EventListener);
    return () => window.removeEventListener('electron-navigate', handler as EventListener);
  }, []);

  // Sync the native Windows close/min/max button strip with the current theme
  useEffect(() => {
    if (!window.electronAPI?.setTitleBarOverlay) return;
    if (isDark) {
      window.electronAPI.setTitleBarOverlay({ color: '#0f172a', symbolColor: '#94a3b8', height: 40 });
    } else {
      window.electronAPI.setTitleBarOverlay({ color: '#ffffff', symbolColor: '#475569', height: 40 });
    }
  }, [isDark]);

  if (!isElectron) return null;

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    setActiveMenu(id);
    const rect = e.currentTarget.getBoundingClientRect();
    window.electronAPI?.showMenu(id, rect.left, rect.bottom + 2);
    // Clear active state after a short delay
    setTimeout(() => setActiveMenu(null), 300);
  };

  return (
    <div
      className={`shrink-0 h-10 flex items-center select-none z-[100] border-b transition-colors duration-200 ${
        isDark
          ? 'bg-slate-900 border-slate-700/60'
          : 'bg-white border-slate-200'
      } ${isMac ? 'pl-20' : 'pl-3'}`}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Logo + App Name */}
      <div
        className={`flex items-center gap-2 pr-5 mr-1 border-r ${
          isDark ? 'border-slate-700' : 'border-slate-200'
        }`}
      >
        <div className={`h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          isDark
            ? 'bg-transparent border border-white/40 shadow-none'
            : 'bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm'
        }`}>
          <span className={`text-[9px] font-black tracking-tighter ${isDark ? 'text-white' : 'text-white'}`}>DC</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[11px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
            DCEL
          </span>
          <span className={`text-[10px] font-medium hidden sm:inline ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
            Office Suite
          </span>
          {version && (
            <span className={`text-[9px] font-medium px-1 py-px rounded ${
              isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
            }`}>
              v{version}
            </span>
          )}
        </div>
      </div>

      {/* Menu Buttons */}
      <div
        className="flex items-center gap-px"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {MENU_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            onClick={(e) => handleMenuClick(e, id)}
            className={`
              flex items-center gap-0.5 px-3 py-1.5 rounded-md text-[11px] font-medium
              transition-all duration-150 group relative
              ${activeMenu === id
                ? isDark
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-600 text-white'
                : isDark
                  ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }
            `}
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {label}
            <ChevronDown className={`h-2.5 w-2.5 transition-transform opacity-50 group-hover:opacity-100 ${activeMenu === id ? 'rotate-180 opacity-100' : ''}`} />
          </button>
        ))}
      </div>

      {/* Spacer — draggable */}
      <div className="flex-1" style={{ WebkitAppRegion: 'drag' } as any} />

      {/* Right Controls */}
      <div
        className="flex items-center gap-1 pr-2"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium
            transition-all duration-150
            ${isDark
              ? 'text-amber-400 hover:bg-slate-800 hover:text-amber-300'
              : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600'
            }
          `}
        >
          {isDark
            ? <Sun className="h-3.5 w-3.5" />
            : <Moon className="h-3.5 w-3.5" />
          }
          <span className="hidden sm:inline">
            {isDark ? 'Light' : 'Dark'}
          </span>
        </button>

        {/* Subtle divider */}
        <div className={`h-4 w-px mx-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Status indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <Monitor className="h-3 w-3" />
          <span className="hidden md:inline">Desktop</span>
        </div>
      </div>
    </div>
  );
}
