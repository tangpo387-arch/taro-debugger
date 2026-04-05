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

// ── DAP IPC Handlers ──────────────────────────────────────────────
let dapWs: any = null; // using global.WebSocket
let dapBuffer: Buffer = Buffer.alloc(0);

ipcMain.handle('dap-invoke', async (event, payload) => {
  const { action, address } = payload as { action: string, address?: string };
  if (action === 'connect' && address) {
    return new Promise<void>((resolve, reject) => {
      if (dapWs) { dapWs.close(); dapWs = null; }
      dapBuffer = Buffer.alloc(0);

      const wsUrl = address.startsWith('ws') ? address : `ws://${address}`;

      // Shared parser logic for raw DAP stream
      const onRawData = (data: Buffer | ArrayBuffer | Uint8Array) => {
        dapBuffer = Buffer.concat([dapBuffer, Buffer.isBuffer(data) ? data : Buffer.from(data as any)]);

        while (dapBuffer.length > 0) {
          if (dapBuffer[0] !== 67) { // 'C'
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-error', 'Protocol error: DAP stream must start with Content-Length');
            dapBuffer = Buffer.alloc(0);
            break;
          }

          const headerEndIdx = dapBuffer.indexOf('\r\n\r\n');
          if (headerEndIdx === -1) {
            if (dapBuffer.length > 256) {
              if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-error', 'DAP Header not found within 256 bytes');
              dapBuffer = Buffer.alloc(0);
            }
            break;
          }

          const headerStr = dapBuffer.toString('utf-8', 0, headerEndIdx);
          const match = headerStr.match(/Content-Length: (\d+)/i);
          if (!match) {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-error', 'Invalid DAP header');
            dapBuffer = dapBuffer.subarray(headerEndIdx + 4);
            continue;
          }

          const contentLen = parseInt(match[1], 10);
          const totalLen = headerEndIdx + 4 + contentLen;

          if (dapBuffer.length < totalLen) {
            break;
          }

          const payloadStr = dapBuffer.toString('utf-8', headerEndIdx + 4, totalLen);
          dapBuffer = dapBuffer.subarray(totalLen);

          try {
            const msg = JSON.parse(payloadStr);
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-message', msg);
          } catch (e: any) {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-error', 'Failed to parse JSON payload. ' + String(e));
          }
        }
      };

      try {
        dapWs = new WebSocket(wsUrl);

        dapWs.onopen = () => resolve();

        let messageQueue: Promise<void> = Promise.resolve();

        dapWs.onmessage = (event: any) => {
          messageQueue = messageQueue.then(async () => {
            try {
              if (event.data instanceof Blob) {
                const arrayBuffer = await event.data.arrayBuffer();
                onRawData(Buffer.from(arrayBuffer));
              } else {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-error', 'Unsupported message data type');
                return;
              }
            } catch (e) {
              console.error('Failed to process WebSocket message:', e);
            }
          });
        };

        dapWs.onerror = (err: any) => {
          // Clear the reference before rejecting to prevent dap-request handlers
          // from attempting to send on a broken socket.
          dapWs = null;
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-error', 'WebSocket error');
          reject(new Error('WebSocket connection error'));
        };

        dapWs.onclose = () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dap-closed');
          dapWs = null;
        };
      } catch (e) {
        reject(e);
      }
    });
  } else if (action === 'disconnect') {
    if (dapWs) { dapWs.close(); dapWs = null; }
    return Promise.resolve();
  }
  return Promise.reject(new Error(`Unknown action: ${action}`));
});

ipcMain.on('dap-request', (event, request) => {
  const payload = JSON.stringify(request);
  const payloadBytes = Buffer.from(payload, 'utf8');
  const header = `Content-Length: ${payloadBytes.byteLength}\r\n\r\n`;

  if (dapWs && dapWs.readyState === 1) { // OPEN
    const blob = new Blob([header, payloadBytes], { type: 'application/json' });
    dapWs.send(blob);
  }
});
