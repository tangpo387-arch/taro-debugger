import { contextBridge, ipcRenderer } from 'electron';

/**
 * The 'electronAPI' is exposed to the renderer process (Angular) via contextBridge.
 * This ensures the renderer cannot access powerful Node.js or Electron APIs directly.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Fire-and-forget IPC message sending to the main process.
   */
  send: (channel: string, data: unknown): void => {
    const validChannels = ['dap-request'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  /**
   * Universal listener for messages coming from the main process.
   */
  on: (channel: string, func: (...args: unknown[]) => void): (() => void) => {
    const validChannels = ['dap-message', 'dap-error', 'dap-closed'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes sender
      const subscription = (_event: unknown, ...args: unknown[]) => func(...args);
      ipcRenderer.on(channel, subscription as Parameters<typeof ipcRenderer.on>[1]);

      // Return cleanup function
      return () => ipcRenderer.removeListener(channel, subscription as Parameters<typeof ipcRenderer.on>[1]);
    }
    return () => { };
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
