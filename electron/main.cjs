const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

/* ─── Globals ──────────────────────────────────────────────────── */
let mainWindow = null;
const isDev = !app.isPackaged;

/* ─── Auto‑Updater Setup ──────────────────────────────────────── */
function initAutoUpdater() {
  if (isDev) return; // skip in dev mode

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Download now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on('update-not-available', () => {
    // silent — no notification needed
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.setProgressBar(-1);
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The app will restart to install.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Check for updates 3 seconds after launch
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}

/* ─── Application Menu ─────────────────────────────────────────── */
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] },
                { name: 'PDF', extensions: ['pdf'] },
              ],
            });
          },
        },
        {
          label: 'Save Page as PDF',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
              defaultPath: `DCEL-HR_${new Date().toISOString().slice(0, 10)}.pdf`,
              filters: [{ name: 'PDF', extensions: ['pdf'] }],
            });
            if (filePath) {
              const data = await mainWindow.webContents.printToPDF({});
              require('fs').writeFileSync(filePath, data);
              dialog.showMessageBox(mainWindow, { type: 'info', message: `Saved to ${filePath}` });
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.print(),
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About DCEL HR',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About DCEL HR',
              message: 'DCEL HR Management System',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`,
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Check for Updates...',
          click: () => {
            if (isDev) {
              dialog.showMessageBox(mainWindow, { type: 'info', message: 'Updates are disabled in development mode.' });
            } else {
              autoUpdater.checkForUpdates();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/your-org/dcel-hr'),
        },
      ],
    },
  ];

  return template;
}

// Map of menu objects for IPC
let menus = {};

function initIPC() {
  const template = buildMenu();
  
  template.forEach(item => {
    menus[item.label.toLowerCase()] = Menu.buildFromTemplate(item.submenu);
  });

  ipcMain.on('show-menu', (event, { id, x, y }) => {
    const menu = menus[id.toLowerCase()];
    if (menu) {
      menu.popup({
        window: BrowserWindow.fromWebContents(event.sender),
        x: Math.round(x),
        y: Math.round(y)
      });
    }
  });
}

/* ─── Main Window ──────────────────────────────────────────────── */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'DCEL HR',
    icon: path.join(__dirname, '..', 'logo', 'logo-1.png'),
    // Hidden title bar but keep native Windows controls overlaid
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f8fafc', // slate-50
      symbolColor: '#334155', // slate-700
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // wait for ready-to-show for a flash-free launch
  });

  // Smooth launch
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    // In dev, load from Vite dev server
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ─── App Lifecycle ────────────────────────────────────────────── */
app.whenReady().then(() => {
  initIPC();
  createWindow();
  initAutoUpdater();

  // macOS re-activate
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
