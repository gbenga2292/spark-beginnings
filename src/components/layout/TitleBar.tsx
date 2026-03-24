import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { useUserStore } from '@/src/store/userStore';
import { useNavigate as useRRNavigate } from 'react-router-dom';

const getElectronAPI = () => (window as any).electronAPI;

const MENU_ITEMS = [
  { id: 'file',     label: 'File' },
  { id: 'view',     label: 'View' },
  { id: 'help',     label: 'Help' },
];

export function TitleBar() {
  const isElectron = getElectronAPI()?.isElectron;
  const isMac = getElectronAPI()?.platform === 'darwin';
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
    getElectronAPI()?.getVersion().then((v: string) => setVersion(v)).catch(() => {});
  }, []);

  // Push current user privileges to main so Navigate menu reflects access
  useEffect(() => {
    if (!getElectronAPI()?.updateMenuPrivileges) return;
    getElectronAPI().updateMenuPrivileges(
      currentUser ? currentUser.privileges : null
    );
  }, [currentUser]);

  // Listen for navigate events from main process menu clicks
  useEffect(() => {
    const handler = (e: CustomEvent) => dispatchNav(e.detail);
    window.addEventListener('electron-navigate', handler as EventListener);
    return () => window.removeEventListener('electron-navigate', handler as EventListener);
  }, []);

  // Sync the native Windows close/min/max button strip with the current theme and zoom scale
  useEffect(() => {
    if (!getElectronAPI()?.setTitleBarOverlay) return;

    const updateControls = () => {
      // Approximate browser zoom level so the native controls scale with the CSS h-10 container
      let zoom = window.innerWidth ? window.outerWidth / window.innerWidth : 1;
      zoom = Math.round(zoom * 20) / 20; // Snap to nearest 0.05 to ignore OS window borders
      if (zoom < 0.2 || zoom > 5) zoom = 1;

      const height = Math.round(40 * zoom);

      if (isDark) {
        getElectronAPI().setTitleBarOverlay({ color: '#0f172a', symbolColor: '#94a3b8', height });
      } else {
        getElectronAPI().setTitleBarOverlay({ color: '#ffffff', symbolColor: '#475569', height });
      }
    };

    updateControls();
    window.addEventListener('resize', updateControls);
    return () => window.removeEventListener('resize', updateControls);
  }, [isDark]);

  if (!isElectron) return null;

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    setActiveMenu(id);
    const rect = e.currentTarget.getBoundingClientRect();
    getElectronAPI()?.showMenu(id, rect.left, rect.bottom + 2);
    // Clear active state after a short delay
    setTimeout(() => setActiveMenu(null), 300);
  };

  return (
    <div
      className={`shrink-0 h-10 flex items-center select-none z-40 border-b transition-colors duration-200 ${
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

        {/* Subtle divider */}
        <div className={`h-4 w-px mx-2 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Theme toggle moved next to the Menu */}
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
      </div>

      {/* Spacer — draggable */}
      <div className="flex-1" style={{ WebkitAppRegion: 'drag' } as any} />

      {/* Right Controls */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >

        {/* Status indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium mr-2 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <Monitor className="h-3 w-3" />
          <span className="hidden md:inline">Desktop</span>
        </div>

        {/* Custom Window Controls */}
        <div className="flex h-10 items-center">
          <button
            onClick={() => getElectronAPI()?.windowMinimize()}
            className={`h-full w-11 flex justify-center items-center transition-colors hover:bg-slate-500/20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="5" width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button
            onClick={() => getElectronAPI()?.windowMaximize()}
            className={`h-full w-11 flex justify-center items-center transition-colors hover:bg-slate-500/20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
          </button>
          {!currentUser && (
            <button
              onClick={() => getElectronAPI()?.windowClose()}
              className={`h-full w-12 flex justify-center items-center transition-colors hover:bg-red-500 hover:text-white ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" strokeWidth="1.2"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
