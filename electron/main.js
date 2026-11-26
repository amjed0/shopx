/**
 * ShopX Elite – Electron Main Process
 *
 * Designed for reliable single-instance POS/Desktop operation.
 * Connects directly to the ShopX Next.js server with auto-retry.
 */

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── Single Instance Lock ─────────────────────────────────────────────────────
// Ensures only ONE instance of the app can ever run.
// Prevents duplicate processes or infinite window opening.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  initApp();
}

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
const SERVER_PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkServerRunning(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.get(
        {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: '/api/auth/me',
          timeout: 2000,
        },
        (res) => {
          res.resume();
          resolve(true);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

function buildMenu() {
  const template = [
    {
      label: 'ShopX',
      submenu: [
        { label: 'About ShopX Elite', role: 'about' },
        { type: 'separator' },
        {
          label: 'Reload Page',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload(),
        },
        {
          label: 'Back to Home',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow && mainWindow.loadURL(SERVER_URL),
        },
        { type: 'separator' },
        { label: 'Quit ShopX', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
  ];

  if (process.env.ELECTRON_DEV === '1') {
    template.push({
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getAppIcon() {
  const ico = path.join(__dirname, '..', 'public', 'icon.ico');
  if (fs.existsSync(ico)) return ico;
  return undefined;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ShopX Elite',
    icon: getAppIcon(),
    backgroundColor: '#090d16',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // Only open HTTP/HTTPS links externally (NEVER file:// or internal schemes)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        if (!url.startsWith(SERVER_URL)) {
          shell.openExternal(url);
          return { action: 'deny' };
        }
        return { action: 'allow' };
      }
    } catch {
      // invalid URL
    }
    return { action: 'deny' };
  });

  // If page fails to load (e.g. server closed while running), show status page
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Only redirect if failing to load the main server URL
    if (validatedURL && validatedURL.startsWith(SERVER_URL)) {
      const statusPage = path.join(__dirname, 'server-status.html');
      if (fs.existsSync(statusPage)) {
        mainWindow.loadFile(statusPage);
      }
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Check if server is running
  const isUp = await checkServerRunning(SERVER_URL);
  if (isUp) {
    mainWindow.loadURL(SERVER_URL);
  } else {
    // Show connection page with auto-retry
    mainWindow.loadFile(path.join(__dirname, 'server-status.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initApp() {
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
