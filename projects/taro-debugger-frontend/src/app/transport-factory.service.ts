import { Injectable } from '@angular/core';
import { TransportType } from './dap-config.service';
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
  createTransport(type: TransportType): DapTransportService {
    switch (type) {
      case 'websocket':
        return new WebSocketTransportService();
      case 'ipc':
        return new IpcTransportService();
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }
}
