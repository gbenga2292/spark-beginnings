import React from 'react';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      showMenu: (id: string, x: number, y: number) => void;
      getVersion: () => Promise<string>;
      checkForUpdates: () => void;
    };
  }
}

export function TitleBar() {
  const isElectron = window.electronAPI?.isElectron;
  const isMac = window.electronAPI?.platform === 'darwin';

  if (!isElectron) return null;

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    window.electronAPI?.showMenu(id, rect.left, rect.bottom);
  };

  return (
    <div 
      className={`shrink-0 h-9 bg-slate-100 border-b border-slate-200 flex items-center px-4 select-none z-50 ${isMac ? 'pl-20' : ''}`}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Title / Logo */}
      <div className="flex items-center gap-2 mr-6 text-slate-800 font-bold text-xs tracking-wide">
        DCEL HR
      </div>

      {/* Menu Buttons */}
      <div className="flex items-center text-xs text-slate-700 font-medium">
        {['File', 'Edit', 'View', 'Help'].map((item) => (
          <button
            key={item}
            onClick={(e) => handleMenuClick(e, item)}
            className="px-3 py-1 rounded hover:bg-slate-200 hover:text-indigo-700 transition-colors focus:bg-slate-300"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
