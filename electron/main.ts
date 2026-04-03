import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Security: Preload script and Context Isolation are MANDATORY.
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
  });

  // Handle environment-dependent loading logic per spec
  const isDev = !app.isPackaged || process.env['ELECTRON_IS_DEV'] === '1';

  if (isDev) {
    // Development mode: load from Angular's dev-server
    mainWindow.loadURL('http://localhost:4200').catch((err) => {
      console.error('Failed to load dev server:', err);
    });
    // Open DevTools in dev mode by default
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: load from built assets (dist folder)
    const indexPath = path.join(__dirname, '../taro-debugger-frontend/browser/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html from dist:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Lifecycle Events ──────────────────────────────────────────────

app.whenReady().then(createWindow).catch(console.error);

app.on('window-all-closed', () => {
  // Respect OS-specific conventions for app termination
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ── IPC Registration ──────────────────────────────────────────────

// Generic listener placeholders for Phase 10 development
ipcMain.handle('get-config', async (_event, _args) => {
  // Future use: Retrieve system-specific paths or configs
  return { platform: process.platform };
});

// Implement more specific IPC handlers as per WI-24 / WI-25 in future steps.
