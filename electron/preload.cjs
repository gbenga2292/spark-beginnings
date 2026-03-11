const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a safe, limited API to the renderer process.
 * Access in your React app via `window.electronAPI`.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Auto-updater controls (for future use in a settings UI)
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),

  // Custom Application Menu trigger
  showMenu: (menuId, x, y) => ipcRenderer.send('show-menu', { id: menuId, x, y }),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
