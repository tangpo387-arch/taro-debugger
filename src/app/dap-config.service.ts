import { Injectable } from '@angular/core';

/**
 * Interface for the complete DAP connection configuration.
 * Includes server address, launch mode, path, and program arguments.
 */
/** Supported transport layer types */
export type TransportType = 'websocket' | 'serial' | 'tcp';

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
  private config: DapConfig = {
    serverAddress: '',
    transportType: 'websocket',
    launchMode: 'launch',
    executablePath: '',
    sourcePath: '',
    programArgs: ''
  };

  /**
   * Save the complete DAP configuration.
   * @param config A complete DapConfig object
   */
  setConfig(config: DapConfig): void {
    this.config = { ...config };
    console.log('DAP configuration saved:', this.config);
  }

  /**
   * Get the current DAP configuration (returns a copy to prevent external direct modification).
   */
  getConfig(): DapConfig {
    return { ...this.config };
  }
}
