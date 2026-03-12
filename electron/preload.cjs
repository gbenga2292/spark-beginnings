const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a safe, limited API to the renderer process.
 * Access in your React app via `window.electronAPI`.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Auto-updater controls
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),

  // Custom Application Menu trigger
  showMenu: (menuId, x, y) => ipcRenderer.send('show-menu', { id: menuId, x, y }),

  // Dynamic title-bar overlay (Windows close/min/max buttons)
  setTitleBarOverlay: (opts) => ipcRenderer.send('set-title-bar-overlay', opts),

  // Push current user privilege snapshot so main can filter nav menus
  updateMenuPrivileges: (privs) => ipcRenderer.send('update-menu-privileges', privs),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
