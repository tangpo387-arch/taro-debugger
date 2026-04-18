import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { DapTransportService } from './dap-transport.service';
import { DapMessage, DapRequest } from '@taro/dap-core';

export interface ElectronAPI {
  send: (channel: string, data: unknown) => void;
  on: (channel: string, func: (...args: unknown[]) => void) => () => void;
  invoke: (channel: string, data: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

@Injectable()
export class IpcTransportService extends DapTransportService {
  private messageSubject = new Subject<DapMessage>();
  private connectionStatusSubject = new Subject<boolean>();
  private _removeEventListeners: Array<() => void> = [];

  override get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  override connect(address: string): Observable<void> {
    return new Observable<void>(observer => {
      if (!window.electronAPI) {
        observer.error(new Error('Electron API not found. Cannot launch IPC Transport.'));
        return;
      }

      // Cleanup any pre-existing listeners
      this._removeEventListeners.forEach(cleanup => cleanup());
      this._removeEventListeners = [];

      this._removeEventListeners.push(
        window.electronAPI.on('dap-message', (msg: unknown) => {
          this.messageSubject.next(msg as DapMessage);
        })
      );

      this._removeEventListeners.push(
        window.electronAPI.on('dap-error', (err: unknown) => {
          this.connectionStatusSubject.next(false);
          this.messageSubject.error(new Error('IPC DAP protocol error: ' + String(err)));
          if (!observer.closed) observer.error(err);
        })
      );

      this._removeEventListeners.push(
        window.electronAPI.on('dap-closed', () => {
          this.connectionStatusSubject.next(false);
          this.messageSubject.complete();
        })
      );

      const resolvedAddress = address || 'localhost:4711';

      window.electronAPI.invoke('dap-invoke', { action: 'connect', address: resolvedAddress })
        .then(() => {
          this.connectionStatusSubject.next(true);
          observer.next();
          observer.complete();
        })
        .catch(err => {
          this.connectionStatusSubject.next(false);
          observer.error(err);
        });
    });
  }

  override disconnect(): void {
    if (window.electronAPI) {
      window.electronAPI.invoke('dap-invoke', { action: 'disconnect' }).catch(console.error);
    }
    this._removeEventListeners.forEach(cleanup => cleanup());
    this._removeEventListeners = [];
    // Complete the current Subject before clearing listeners so all subscribers
    // receive the terminal signal. A new Subject is created immediately to be
    // ready for the next connect() call without residual state.
    this.messageSubject.complete();
    this.messageSubject = new Subject<DapMessage>();
    this.connectionStatusSubject.next(false);
  }

  override sendRequest(request: DapRequest): void {
    if (!window.electronAPI) {
      console.error('Electron API not found');
      return;
    }
    window.electronAPI.send('dap-request', request);
  }

  override onMessage(): Observable<DapMessage> {
    return this.messageSubject.asObservable();
  }
}
