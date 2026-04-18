import { Injectable } from '@angular/core';
import { TransportType } from '@taro/dap-core';

/**
 * Interface for the complete DAP connection configuration.
 * Includes server address, launch mode, path, and program arguments.
 */

export interface DapConfig {
  /** DAP Server connection address, format host:port (e.g., localhost:4711) */
  serverAddress: string;

  /** Transport type: websocket, serial, or tcp */
  transportType: TransportType;

  /** Launch mode: 'launch' starts the process, 'attach' attaches to an existing one */
  launchMode: 'launch' | 'attach';

  /** Path to the executable being debugged */
  executablePath: string;

  /** Path to the root source code directory */
  sourcePath: string;

  /** Command-line arguments passed to the debuggee (optional) */
  programArgs: string;
}

/**
 * DapConfigService
 *
 * State management service, responsible for passing the DAP configuration between
 * the setup page (SetupComponent) and the debugger page (DebuggerComponent).
 */
@Injectable({
  providedIn: 'root'
})
export class DapConfigService {
  private static readonly STORAGE_KEY = 'taro_dap_config';

  private config: DapConfig = {
    serverAddress: 'localhost:4711',
    transportType: 'websocket',
    launchMode: 'launch',
    executablePath: '',
    sourcePath: '',
    programArgs: ''
  };

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Save the complete DAP configuration and sync with localStorage.
   * @param config A complete DapConfig object
   */
  setConfig(config: DapConfig): void {
    this.config = { ...config };
    localStorage.setItem(DapConfigService.STORAGE_KEY, JSON.stringify(this.config));
    console.log('DAP configuration saved and persisted:', this.config);
  }

  /**
   * Get the current DAP configuration (returns a copy to prevent external direct modification).
   */
  getConfig(): DapConfig {
    return { ...this.config };
  }

  /**
   * Load the initial configuration from localStorage.
   */
  private loadFromStorage(): void {
    const stored = localStorage.getItem(DapConfigService.STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.config = { ...this.config, ...parsed };
      } catch (e) {
        console.error('Failed to parse stored DAP configuration:', e);
      }
    }
  }
}

