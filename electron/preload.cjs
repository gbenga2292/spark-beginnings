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

  // Window custom controls
  windowHideToTray: () => ipcRenderer.send('window-hide-to-tray'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Push current user privilege snapshot so main can filter nav menus
  updateMenuPrivileges: (privs) => ipcRenderer.send('update-menu-privileges', privs),

  // Platform info
  platform: process.platform,
  isElectron: true,

  // Native file / folder picker
  openPathDialog: (opts) => ipcRenderer.invoke('dialog:open-path', opts),
  savePathDialog: (opts) => ipcRenderer.invoke('dialog:save-path', opts),
  
  // Write file natively
  writeFile: (filePath, content, encoding = 'utf8') => ipcRenderer.invoke('file:write', { filePath, content, encoding }),

  // OS Shell integration (open file/folder natively)
  shellOpenPath: (path) => ipcRenderer.send('shell:open-path', path),

  // Native notification via main process (shows correct app name & icon on Windows)
  notify: (title, body) => ipcRenderer.send('app:notify', { title, body }),
});
