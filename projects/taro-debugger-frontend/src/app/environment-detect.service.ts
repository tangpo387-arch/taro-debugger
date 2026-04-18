import { Injectable } from '@angular/core';

/**
 * Environment Detect Service
 * Exposes utilities to detect the runtime environment (e.g. Electron vs Browser).
 */
@Injectable({
  providedIn: 'root'
})
export class EnvironmentDetectService {
  /**
   * Checks if the application is running within the Electron environment.
   * This relies on the 'electronAPI' object exposed by the Electron preload script via contextBridge.
   */
  public isElectron(): boolean {
    return !!(window as any).electronAPI;
  }
}
