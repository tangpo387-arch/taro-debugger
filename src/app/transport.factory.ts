import { TransportType } from './dap-config.service';
import { DapTransportService } from './dap-transport.service';
import { WebSocketTransportService } from './websocket-transport.service';

/**
 * Transport 工廠函式
 * 根據傳入的 TransportType 建立對應的 DapTransportService 實例。
 * 
 * 未來新增 Serial 或 TCP 傳輸時，只需：
 * 1. 建立新的 Service (e.g., SerialTransportService extends DapTransportService)
 * 2. 在此工廠新增對應的 case
 * 3. 在 TransportType 型別中加入新選項
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
