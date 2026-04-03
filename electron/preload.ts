import { contextBridge, ipcRenderer } from 'electron';

/**
 * The 'electronAPI' is exposed to the renderer process (Angular) via contextBridge.
 * This ensures the renderer cannot access powerful Node.js or Electron APIs directly.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Generic IPC message sending (two-way or fire-and-forget depending on implementation).
   * Detailed implementations for DAP and File I/O will be added in Phase 10 (WI-24, WI-25).
   */
  send: (channel: string, data: unknown): void => {
    // Only allow specific channels for security
    const validChannels = ['dap-request', 'file-tree-request', 'file-read-request'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  /**
   * Universal listener for messages coming from the main process.
   */
  on: (channel: string, func: (...args: unknown[]) => void): (() => void) => {
    const validChannels = ['dap-event', 'dap-response', 'file-tree-response', 'file-read-response'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes sender
      const subscription = (_event: unknown, ...args: unknown[]) => func(...args);
      ipcRenderer.on(channel, subscription as Parameters<typeof ipcRenderer.on>[1]);

      // Return cleanup function
      return () => ipcRenderer.removeListener(channel, subscription as Parameters<typeof ipcRenderer.on>[1]);
    }
    return () => {};
  },

  /**
   * One-time request (invoke) pattern for async/await interactions.
   */
  invoke: (channel: string, data: unknown): Promise<unknown> => {
    const validChannels = ['dap-invoke', 'get-config'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Unauthorized channel: ${channel}`));
  }
});
