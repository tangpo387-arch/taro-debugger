import { TransportType } from './dap-config.service';
import { DapTransportService } from './dap-transport.service';
import { WebSocketTransportService } from './websocket-transport.service';

/**
 * Transport Factory Function
 * Creates the corresponding DapTransportService instance based on the provided TransportType.
 * 
 * When adding Serial or TCP transport in the future:
 * 1. Create a new Service (e.g., SerialTransportService extends DapTransportService)
 * 2. Add the corresponding case in this factory
 * 3. Add the new option to the TransportType type
 */
export function createTransport(type: TransportType): DapTransportService {
  switch (type) {
    case 'websocket':
      return new WebSocketTransportService();
    // case 'serial':
    //   return new SerialTransportService();
    // case 'tcp':
    //   return new TcpTransportService();
    default:
      throw new Error(`Unsupported transport type: ${type}`);
  }
}
