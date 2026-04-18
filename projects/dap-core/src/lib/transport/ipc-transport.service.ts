import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { DapTransportService } from './dap-transport.service';
import { DapMessage, DapRequest } from '../dap.types';
import { ELECTRON_API } from './electron-api.token';

@Injectable()
export class IpcTransportService extends DapTransportService {
  private readonly electronAPI = inject(ELECTRON_API, { optional: true });
  private messageSubject = new Subject<DapMessage>();
  private connectionStatusSubject = new Subject<boolean>();
  private _removeEventListeners: Array<() => void> = [];

  override get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  override connect(address: string): Observable<void> {
    return new Observable<void>(observer => {
      if (!this.electronAPI) {
        observer.error(new Error('Electron API not provided. Cannot launch IPC Transport.'));
        return;
      }

      // Cleanup any pre-existing listeners
      this._removeEventListeners.forEach(cleanup => cleanup());
      this._removeEventListeners = [];

      this._removeEventListeners.push(
        this.electronAPI.on('dap-message', (msg: unknown) => {
          this.messageSubject.next(msg as DapMessage);
        })
      );

      this._removeEventListeners.push(
        this.electronAPI.on('dap-error', (err: unknown) => {
          this.connectionStatusSubject.next(false);
          this.messageSubject.error(new Error('IPC DAP protocol error: ' + String(err)));
          if (!observer.closed) observer.error(err);
        })
      );

      this._removeEventListeners.push(
        this.electronAPI.on('dap-closed', () => {
          this.connectionStatusSubject.next(false);
          this.messageSubject.complete();
        })
      );

      const resolvedAddress = address || 'localhost:4711';

      this.electronAPI.invoke('dap-invoke', { action: 'connect', address: resolvedAddress })
        .then(() => {
          this.connectionStatusSubject.next(true);
          observer.next();
          observer.complete();
        })
        .catch((err: any) => {
          this.connectionStatusSubject.next(false);
          observer.error(err);
        });
    });
  }

  override disconnect(): void {
    if (this.electronAPI) {
      this.electronAPI.invoke('dap-invoke', { action: 'disconnect' }).catch(console.error);
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
    if (!this.electronAPI) {
      console.error('Electron API not provided');
      return;
    }
    this.electronAPI.send('dap-request', request);
  }

  override onMessage(): Observable<DapMessage> {
    return this.messageSubject.asObservable();
  }
}
