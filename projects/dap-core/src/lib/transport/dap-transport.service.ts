import { Observable } from 'rxjs';
import { DapRequest, DapMessage } from '../dap.types';

export abstract class DapTransportService {
  /**
   * Connect to the DAP Server
   * @param address Connection address (e.g., localhost:4711 or remote WebSocket URI)
   * @returns Observable that completes when connection is established
   */
  abstract connect(address: string): Observable<void>;

  /**
   * Disconnect from the DAP Server
   */
  abstract disconnect(): void;

  /**
   * Send a DAP request to the Server
   * @param request The request object to be sent
   */
  abstract sendRequest(request: DapRequest): void;

  /**
   * Get all message streams from the Server (Observable)
   * For the Session layer to match requests and responses
   */
  abstract onMessage(): Observable<DapMessage>;

  /**
   * Get the connection status stream (Observable)
   */
  abstract get connectionStatus$(): Observable<boolean>;
}
