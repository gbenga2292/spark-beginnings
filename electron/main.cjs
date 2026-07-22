const { app, BrowserWindow, Menu, dialog, shell, ipcMain, Notification, Tray } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

/* ─── Disable Hardware Acceleration (Fixes VM/RDP GPU crashes) ─── */
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

/* ─── Single Instance Lock ─────────────────────────────────────── */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/* ─── Globals ──────────────────────────────────────────────────── */
let mainWindow = null;
let tray = null;
let manualCheck = false;
const isDev = !app.isPackaged;

/* ─── Auto‑Updater Setup ──────────────────────────────────────── */
function initAutoUpdater() {
  if (isDev) return; // skip in dev mode

  const fs = require('fs');
  const nasPath = '\\\\MYCLOUDEX2ULTRA\\DCEL_Share\\Updates\\';
  
  // If the NAS is reachable, use it as the primary update source
  if (fs.existsSync(nasPath)) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: `file:///${nasPath.replace(/\\/g, '/')}`
    });
  } else {
    // If NAS is not found (e.g. user is off-site), default to the web server
    console.log('NAS not reachable, defaulting to web server for updates.');
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://dewaterconstruct.com/app-updates/'
    });
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    if (manualCheck) {
      mainWindow?.webContents.send('updater:status', { type: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    if (manualCheck) {
      mainWindow?.webContents.send('updater:status', { type: 'available', version: info.version });
      autoUpdater.downloadUpdate();
    } else {
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
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (manualCheck) {
      mainWindow?.webContents.send('updater:status', { type: 'not-available' });
      manualCheck = false;
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (manualCheck) {
      mainWindow?.webContents.send('updater:status', { type: 'downloading', percent: Math.round(progressObj.percent) });
    }
    mainWindow?.setProgressBar(progressObj.percent / 100);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.setProgressBar(-1);
    if (manualCheck) {
      mainWindow?.webContents.send('updater:status', { type: 'downloaded' });
      try {
        const noti = new Notification({
          title: 'Update Ready to Install',
          body: 'The update was downloaded in the background. Click to restart and install.',
        });
        noti.on('click', () => {
          autoUpdater.quitAndInstall();
        });
        noti.show();
      } catch (notiErr) {
        console.error('Failed to show notification:', notiErr);
      }
    } else {
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
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    if (manualCheck) {
      mainWindow?.webContents.send('updater:status', { type: 'error', message: err.message || 'Unknown error' });
      manualCheck = false;
    }
  });

  // Check for updates 3 seconds after launch (runs in background mode)
  setTimeout(() => {
    manualCheck = false;
    autoUpdater.checkForUpdates();
  }, 3000);
}


// ── Customize the OS App Identity for Notifications
// Must be set BEFORE app is ready so Windows uses it for notification grouping
app.setAppUserModelId('com.dcel.hr');
app.name = 'DCEL Office Suite';

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
  const fileTemplate = [
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
          manualCheck = true;
          autoUpdater.checkForUpdates();
        }
      },
    },
    { type: 'separator' },
    { label: 'Exit', accelerator: 'Alt+F4', role: 'quit' },
  ];

  const fileMenu = Menu.buildFromTemplate(fileTemplate);

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

  // NAS connectivity check
  ipcMain.handle('updater:check-nas-status', async (_event, nasPathToCheck) => {
    try {
      const fs = require('fs');
      const cleanPath = nasPathToCheck.replace(/\\+$/, '');

      // 1. If path exists natively (already authenticated & folder exists), return online
      if (fs.existsSync(cleanPath)) {
        return { status: 'online' };
      }

      // 2. If not found, use Windows 'net view' to check SMB server status
      // This handles NetBIOS/LLMNR name resolution and parses native Windows error codes.
      const parts = cleanPath.split('\\').filter(Boolean);
      if (parts.length > 0) {
        const host = parts[0];
        
        const result = await new Promise((resolve) => {
          const { exec } = require('child_process');
          exec(`net view \\\\${host}`, (error, stdout, stderr) => {
            const output = (stdout + stderr).toLowerCase();
            const rawError = (stdout + stderr).trim();
            
            if (!error) {
              // Server is online and we are authenticated, but the specific folder may be missing
              resolve({ status: 'online' });
            } else if (
              output.includes('access is denied') ||
              output.includes('system error 5') ||
              output.includes('system error 86') ||
              output.includes('password') ||
              output.includes('credentials') ||
              output.includes('system error 1219')
            ) {
              // Server is online but we need credentials
              resolve({ status: 'auth-required', error: rawError });
            } else {
              // Server is completely offline or unreachable (e.g. system error 53 / 1203)
              resolve({ status: 'offline', error: rawError });
            }
          });
        });

        return result;
      }
      
      return { status: 'offline', error: 'Invalid path format' };
    } catch (err) {
      console.error('check-nas-status error:', err);
      return { status: 'offline', error: err.message };
    }
  });

  // NAS programmatic authentication
  ipcMain.handle('updater:authenticate-nas', async (_event, { path: nasPathToAuth, username, password }) => {
    return new Promise((resolve) => {
      const parts = nasPathToAuth.split('\\').filter(Boolean);
      if (parts.length < 2) {
        resolve({ success: false, error: 'Invalid network share path format' });
        return;
      }
      const shareRoot = `\\\\${parts[0]}\\${parts[1]}`;

      const { exec } = require('child_process');
      const safePassword = password.replace(/"/g, '\\"');
      const cmd = `net use "${shareRoot}" "${safePassword}" /user:"${username}" /persistent:no`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('net use authentication failed:', stderr || error.message);
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  // Start the check-for-updates sequence targeting NAS or Web
  ipcMain.on('updater:start-check', (event, source) => {
    if (isDev) {
      mainWindow?.webContents.send('updater:status', { type: 'error', message: 'Updates are disabled in development mode.' });
      return;
    }

    manualCheck = true;

    if (source === 'nas') {
      const nasPath = '\\\\MYCLOUDEX2ULTRA\\DCEL_Share\\Updates\\';
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: `file:///${nasPath.replace(/\\/g, '/')}`
      });
    } else {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://dewaterconstruct.com/app-updates/'
      });
    }

    autoUpdater.checkForUpdates();
  });

  ipcMain.on('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.on('check-for-updates', () => {

    if (isDev) {
      dialog.showMessageBox(mainWindow, { type: 'info', message: 'Updates are disabled in development mode.' });
    } else {
      manualCheck = true;
      autoUpdater.checkForUpdates();
    }
  });

  ipcMain.on('window-hide-to-tray', () => {
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  // Native folder / file picker – returns selected path or null
  ipcMain.handle('dialog:open-path', async (_event, opts = {}) => {
    const properties = opts.folder
      ? ['openDirectory']
      : ['openFile', 'multiSelections'];
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: opts.title || 'Select file or folder',
      properties,
      ...(opts.folder ? {} : {
        filters: opts.filters || [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'] },
        ],
      })
    });
    if (canceled || !filePaths.length) return null;
    return opts.folder ? filePaths[0] : filePaths;
  });

  // Native "Save As" picker - returns selected path or null
  ipcMain.handle('dialog:save-path', async (_event, opts = {}) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: opts.title || 'Save File',
      defaultPath: opts.defaultPath || '',
      filters: opts.filters || [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'PDF', extensions: ['pdf'] },
      ],
    });
    if (canceled) return null;
    return filePath;
  });

  // Write file contents to disk (renderer needs this if it can't use fs)
  ipcMain.handle('file:write', async (_event, { filePath, content, encoding }) => {
    try {
      const fs = require('fs');
      const p = require('path');
      fs.mkdirSync(p.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, encoding);
      return true;
    } catch (err) {
      console.error('File write error:', err);
      return false;
    }
  });

  // File system utilities for NAS sync
  ipcMain.handle('fs:exists', (_event, pathToCheck) => {
    try {
      return require('fs').existsSync(pathToCheck);
    } catch { return false; }
  });

  ipcMain.handle('fs:mkdir', (_event, dirPath) => {
    try {
      require('fs').mkdirSync(dirPath, { recursive: true });
      return true;
    } catch (err) {
      console.error('Mkdir error:', err);
      return false;
    }
  });

  // Open a file or folder in the default OS File Explorer / App
  ipcMain.on('shell:open-path', (event, filePath) => {
    if (filePath) shell.openPath(filePath);
  });

  // ── Native notification from main process (correct app name/icon on Windows)
  ipcMain.on('app:notify', (_event, { title, body }) => {
    if (!Notification.isSupported()) return;
    const iconPath = path.join(__dirname, '..', 'logo', 'logo-2.png');
    const n = new Notification({
      title,
      body: body || '',
      icon: iconPath,
      // Ensures Windows shows the app name, not "Electron"
      appName: 'DCEL Office Suite',
    });
    n.show();
  });

  // ── Supabase Native Database Backup via CLI ──
  ipcMain.handle('db:backup-supabase', async (_event, opts = {}) => {
    const fs = require('fs');
    const p = require('path');
    const os = require('os');
    const { execSync } = require('child_process');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const defaultFileName = `Supabase_DB_Backup_${dateStr}.zip`;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Supabase Database Backup',
      defaultPath: defaultFileName,
      filters: [
        { name: 'ZIP Archive', extensions: ['zip'] },
        { name: 'SQL File', extensions: ['sql'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    const dbUrl = opts.dbUrl || process.env.SUPABASE_DB_URL || process.env.VITE_SUPABASE_DB_URL;

    // Create temporary work directory
    const tempDir = fs.mkdtempSync(p.join(os.tmpdir(), 'supabase-backup-'));

    try {
      if (dbUrl) {
        // Run Supabase CLI dumps
        const rolesFile = p.join(tempDir, 'roles.sql');
        const schemaFile = p.join(tempDir, 'schema.sql');
        const dataFile = p.join(tempDir, 'data.sql');

        execSync(`supabase db dump --db-url "${dbUrl}" -f "${rolesFile}" --role-only`, { encoding: 'utf8' });
        execSync(`supabase db dump --db-url "${dbUrl}" -f "${schemaFile}"`, { encoding: 'utf8' });
        execSync(`supabase db dump --db-url "${dbUrl}" -f "${dataFile}" --use-copy --data-only`, { encoding: 'utf8' });

        if (filePath.endsWith('.sql')) {
          // If saving directly as a single .sql file, combine them
          const combined = `-- Supabase Roles DDL\n` + fs.readFileSync(rolesFile, 'utf8') +
                           `\n\n-- Supabase Schema DDL\n` + fs.readFileSync(schemaFile, 'utf8') +
                           `\n\n-- Supabase Data\n` + fs.readFileSync(dataFile, 'utf8');
          fs.writeFileSync(filePath, combined, 'utf8');
        } else {
          // Zip using PowerShell Compress-Archive
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          execSync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*.sql' -DestinationPath '${filePath}' -Force"`);
        }

        // Clean up temp dir
        fs.rmSync(tempDir, { recursive: true, force: true });
        return { success: true, filePath, method: 'cli', message: 'Full database dump completed successfully' };
      } else {
        // If DB URL is missing, return fallback signal so renderer can export via client
        fs.rmSync(tempDir, { recursive: true, force: true });
        return { success: false, fallbackToClient: true, filePath, message: 'No direct database connection string configured. Using table exporter...' };
      }
    } catch (err) {
      console.error('Supabase CLI backup error:', err);
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
      return { success: false, fallbackToClient: true, filePath, message: err.message || 'CLI dump error' };
    }
  });
}

/* ─── Tray Setup ───────────────────────────────────────────────── */
function initTray() {
  const iconPath = path.join(__dirname, '..', 'logo', 'logo-2.png');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open DCEL Office Suite', click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    } },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.isQuitting = true;
      app.quit();
    } }
  ]);
  tray.setToolTip('DCEL Office Suite');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
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
    // Frameless window to allow complete custom titlebar
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true,
    },
    show: false, // wait for ready-to-show for a flash-free launch
  });

  // Smooth launch — set zoom and maximize before first paint
  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.setZoomFactor(1.0);
    mainWindow.maximize();
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
  initTray();
  initAutoUpdater();

  // macOS re-activate
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
