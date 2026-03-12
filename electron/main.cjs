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

/* ─── Current user privileges (updated via IPC from renderer) ─── */
let currentPrivileges = null; // null = super admin (no user record)

/* ─── Privilege helper ─────────────────────────────────────────── */
function can(page, field) {
  if (!currentPrivileges) return true; // super admin sees everything
  const p = currentPrivileges[page];
  return p ? !!p[field] : false;
}

/* ─── Build context menus ──────────────────────────────────────── */
function buildMenus() {
  /* ── FILE ──────────────────────────────────────────────────── */
  const fileMenu = Menu.buildFromTemplate([
    {
      label: '⊕  New Invoice',
      enabled: can('billing', 'canCreate'),
      click: () => mainWindow?.webContents.executeJavaScript(`window.location.hash='/invoices'`),
    },
    {
      label: '⊕  New Employee',
      enabled: can('employees', 'canAdd'),
      click: () => mainWindow?.webContents.executeJavaScript(`window.location.hash='/employees'`),
    },
    {
      label: '⊕  New Leave Request',
      enabled: can('leaves', 'canAdd'),
      click: () => mainWindow?.webContents.executeJavaScript(`window.location.hash='/leaves'`),
    },
    { type: 'separator' },
    {
      label: 'Save Page as PDF',
      accelerator: 'CmdOrCtrl+S',
      click: async () => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
          defaultPath: `DCEL_${new Date().toISOString().slice(0, 10)}.pdf`,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (filePath) {
          const data = await mainWindow.webContents.printToPDF({});
          require('fs').writeFileSync(filePath, data);
          dialog.showMessageBox(mainWindow, { type: 'info', message: `Saved to ${filePath}` });
        }
      },
    },
    {
      label: 'Print Page...',
      accelerator: 'CmdOrCtrl+P',
      click: () => mainWindow.webContents.print(),
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        if (isDev) {
          dialog.showMessageBox(mainWindow, { type: 'info', message: 'Updates are disabled in dev mode.' });
        } else {
          autoUpdater.checkForUpdates();
        }
      },
    },
    { type: 'separator' },
    { label: 'Exit', accelerator: 'Alt+F4', role: 'quit' },
  ]);

  /* ── NAVIGATE (replaces Edit — app-specific page links) ─────── */
  const navItems = [];

  if (can('dashboard', 'canView')) {
    navItems.push({ label: 'Dashboard', click: () => mainWindow?.webContents.send('navigate', '/') });
  }

  // HR section
  const hrItems = [
    can('employees',  'canView') && { label: 'Employees',           click: () => mainWindow?.webContents.send('navigate', '/employees') },
    can('attendance', 'canView') && { label: 'Daily Register',       click: () => mainWindow?.webContents.send('navigate', '/attendance') },
    can('leaves',     'canView') && { label: 'Leaves',               click: () => mainWindow?.webContents.send('navigate', '/leaves') },
    can('salaryLoans','canView') && { label: 'Salary & Loan Advance', click: () => mainWindow?.webContents.send('navigate', '/salary-loans') },
    can('reports',    'canView') && { label: 'Employee Reports',      click: () => mainWindow?.webContents.send('navigate', '/reports') },
  ].filter(Boolean);

  if (hrItems.length > 0) {
    navItems.push({ type: 'separator' }, { label: '── HR ──────────', enabled: false }, ...hrItems);
  }

  // Admin section
  const adminItems = [
    can('sites', 'canView') && { label: 'Sites & Clients', click: () => mainWindow?.webContents.send('navigate', '/sites') },
  ].filter(Boolean);

  if (adminItems.length > 0) {
    navItems.push({ type: 'separator' }, { label: '── Admin ───────', enabled: false }, ...adminItems);
  }

  // Account section
  const accountItems = [
    can('billing',         'canView') && { label: 'Invoices',        click: () => mainWindow?.webContents.send('navigate', '/invoices') },
    can('payments',        'canView') && { label: 'Payments',        click: () => mainWindow?.webContents.send('navigate', '/payments') },
    can('payments',        'canViewVat') && { label: 'VAT',          click: () => mainWindow?.webContents.send('navigate', '/vat') },
    can('payroll',         'canView') && { label: 'Payroll',         click: () => mainWindow?.webContents.send('navigate', '/payroll') },
    can('financialReports','canView') && { label: 'Account Reports', click: () => mainWindow?.webContents.send('navigate', '/financial-reports') },
  ].filter(Boolean);

  if (accountItems.length > 0) {
    navItems.push({ type: 'separator' }, { label: '── Account ─────', enabled: false }, ...accountItems);
  }

  // System section (admin only)
  const sysItems = [
    !currentPrivileges                   && { label: 'Settings',        click: () => mainWindow?.webContents.send('navigate', '/settings') },
    can('users', 'canView')              && { label: 'User Management', click: () => mainWindow?.webContents.send('navigate', '/users') },
    can('variables', 'canView')          && { label: 'Variables',       click: () => mainWindow?.webContents.send('navigate', '/variables') },
  ].filter(Boolean);

  if (sysItems.length > 0) {
    navItems.push({ type: 'separator' }, { label: '── System ──────', enabled: false }, ...sysItems);
  }

  const navigateMenu = Menu.buildFromTemplate(navItems.length > 0 ? navItems : [{ label: 'No pages available', enabled: false }]);

  /* ── VIEW ───────────────────────────────────────────────────── */
  const viewMenu = Menu.buildFromTemplate([
    { role: 'reload',       label: 'Reload Page' },
    { role: 'forceReload',  label: 'Force Reload' },
    { type: 'separator' },
    { role: 'zoomIn',       label: 'Zoom In',    accelerator: 'CmdOrCtrl+=' },
    { role: 'zoomOut',      label: 'Zoom Out' },
    { role: 'resetZoom',    label: 'Reset Zoom' },
    { type: 'separator' },
    { role: 'togglefullscreen', label: 'Toggle Full Screen' },
    ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Developer Tools' }] : []),
  ]);

  /* ── HELP ───────────────────────────────────────────────────── */
  const helpMenu = Menu.buildFromTemplate([
    {
      label: 'About DCEL Office Suite',
      click: () => dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About DCEL Office Suite',
        message: 'DCEL Office Management System',
        detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
        buttons: ['OK'],
      }),
    },
    { type: 'separator' },
    {
      label: 'Keyboard Shortcuts',
      click: () => dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Keyboard Shortcuts',
        message: 'DCEL Office Suite Shortcuts',
        detail: [
          'Ctrl+P  — Print current page',
          'Ctrl+S  — Save as PDF',
          'Ctrl+=  — Zoom In',
          'Ctrl+-  — Zoom Out',
          'F11     — Toggle Full Screen',
          'F5      — Reload',
        ].join('\n'),
        buttons: ['OK'],
      }),
    },
    { type: 'separator' },
    {
      label: 'Report an Issue',
      click: () => shell.openExternal('mailto:support@dcel.ng?subject=DCEL Office Suite Issue'),
    },
  ]);

  return { file: fileMenu, navigate: navigateMenu, view: viewMenu, help: helpMenu };
}

/* ─── IPC Setup ────────────────────────────────────────────────── */
let menus = {};

function initIPC() {
  menus = buildMenus();

  // Show the context menu for the clicked title-bar button
  ipcMain.on('show-menu', (event, { id, x, y }) => {
    const key = id.toLowerCase();
    const menu = menus[key];
    if (menu) {
      menu.popup({
        window: BrowserWindow.fromWebContents(event.sender),
        x: Math.round(x),
        y: Math.round(y),
      });
    }
  });

  // Rebuild Navigate menu whenever user logs in / out
  ipcMain.on('update-menu-privileges', (event, privs) => {
    currentPrivileges = privs; // null = super admin
    menus = buildMenus();
  });

  // Handle navigation messages from menus
  ipcMain.on('navigate-to', (event, route) => {
    mainWindow?.webContents.send('navigate', route);
  });

  ipcMain.handle('get-version', () => app.getVersion());

  ipcMain.on('check-for-updates', () => {
    if (isDev) {
      dialog.showMessageBox(mainWindow, { type: 'info', message: 'Updates are disabled in development mode.' });
    } else {
      autoUpdater.checkForUpdates();
    }
  });

  ipcMain.on('set-title-bar-overlay', (event, opts) => {
    try {
      if (mainWindow && process.platform === 'win32') {
        mainWindow.setTitleBarOverlay(opts);
      }
    } catch (e) {
      // ignore — not critical
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
    title: 'DCEL Office Suite',
    icon: path.join(__dirname, '..', 'logo', 'logo-1.png'),
    // Hidden title bar but keep native Windows controls overlaid
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',        // slate-900 — matches dark titlebar
      symbolColor: '#94a3b8',  // slate-400 — soft but visible
      height: 40,
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
