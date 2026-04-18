import { inject, Injectable, Injector } from '@angular/core';
import { TransportType } from '../dap.types';
import { DapTransportService } from './dap-transport.service';
import { WebSocketTransportService } from './websocket-transport.service';
import { IpcTransportService } from './ipc-transport.service';

/**
 * Transport Factory Service
 * Creates the corresponding DapTransportService instance based on the provided TransportType.
 */
@Injectable({
  providedIn: 'root'
})
export class TransportFactoryService {
  private readonly injector = inject(Injector);

  createTransport(type: TransportType): DapTransportService {
    switch (type) {
      case 'websocket':
        return this.injector.get(WebSocketTransportService);
      case 'ipc':
        return this.injector.get(IpcTransportService);
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }
}
