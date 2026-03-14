import { Observable } from 'rxjs';
import { DapRequest, DapEvent, DapMessage } from './dap.types';

export abstract class DapTransportService {
  /**
   * 連線至 DAP Server
   * @param address 連線位址（例如：localhost:4711 或遠端 WebSocket URI）
   * @returns 成功連線完成的 Observable
   */
  abstract connect(address: string): Observable<void>;

  /**
   * 斷開 DAP Server 連線
   */
  abstract disconnect(): void;

  /**
   * 發送 DAP 請求至 Server
   * @param request 要發送的請求物件
   */
  abstract sendRequest(request: DapRequest): void;

  /**
   * 取得 DAP 事件串流 (Observable)
   * 供前端視圖或服務監聽 Server 發佈的事件 (例如 stopped, breakpoint)
   */
  abstract onEvent(): Observable<DapEvent>;

  /**
   * 取得所有來自 Server 的訊息串流 (Observable)
   * 供 Session 層進行請求與回應 (response) 的配對
   */
  abstract onMessage(): Observable<DapMessage>;

  /**
   * 取出連線狀態的串流 (Observable)
   */
  abstract get connectionStatus$(): Observable<boolean>;
}
