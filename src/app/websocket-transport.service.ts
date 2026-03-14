import { Injectable } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';
import { DapTransportService } from './dap-transport.service';
import { DapMessage, DapRequest, DapEvent } from './dap.types';

@Injectable({
  providedIn: 'root'
})
export class WebSocketTransportService extends DapTransportService {
  private socket?: WebSocket;
  private messageSubject = new Subject<DapMessage>();
  private connectionStatusSubject = new Subject<boolean>();
  
  private buffer = '';

  override get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  override connect(address: string): Observable<void> {
    return new Observable<void>(observer => {
      // 若沒有加上 ws:// 或 wss://，則預設加上 ws://
      const wsUrl = address.startsWith('ws') ? address : `ws://${address}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.connectionStatusSubject.next(true);
        observer.next();
        observer.complete();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          this.handleData(event.data);
        } else if (event.data instanceof Blob) {
           event.data.text().then(text => this.handleData(text));
        }
      };

      this.socket.onerror = (error) => {
        this.connectionStatusSubject.next(false);
        observer.error(error);
      };

      this.socket.onclose = () => {
        this.connectionStatusSubject.next(false);
      };
    });
  }

  override disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
    this.connectionStatusSubject.next(false);
  }

  override sendRequest(request: DapRequest): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }
    
    const payload = JSON.stringify(request);
    // 根據 DAP 規格，送出的資料需包含 Content-Length header
    // 計算 payload 位元組長度
    const contentLength = new Blob([payload]).size;
    const message = `Content-Length: ${contentLength}\r\n\r\n${payload}`;
    
    this.socket.send(message);
  }

  override onEvent(): Observable<DapEvent> {
    return this.messageSubject.pipe(
      filter(msg => msg.type === 'event'),
      map(msg => msg as DapEvent)
    );
  }

  override onMessage(): Observable<DapMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * 處理來自 WebSocket 的資料流，包含 Content-Length 的解析
   */
  private handleData(data: string): void {
    this.buffer += data;

    while (true) {
      const headerMatch = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/i);
      if (!headerMatch) {
        // 如果沒有 Content-Length header，有可能 Server 是直接傳送 JSON
        // 我們嘗試直接 parse 看看（有些 WebSocket bridge 會自動拆掉 header）
        if (this.buffer.trim().startsWith('{') && this.buffer.trim().endsWith('}')) {
          try {
            const message = JSON.parse(this.buffer.trim()) as DapMessage;
            this.messageSubject.next(message);
            this.buffer = ''; // 成功解析則清空
          } catch (e) {
            console.error('[tarodap debug] Failed to parse payload directly:', e, this.buffer.trim());
          }
        }
        break; // 等待更多資料
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const headerLength = headerMatch[0].length;
      const totalLength = headerLength + contentLength;

      if (this.buffer.length < totalLength) {
        break; // 內容尚未完全接收
      }

      const payload = this.buffer.substring(headerLength, totalLength);
      this.buffer = this.buffer.substring(totalLength);

      try {
        const message = JSON.parse(payload) as DapMessage;
        this.messageSubject.next(message);
      } catch (e) {
        console.error('Failed to parse DAP message:', e, payload);
      }
    }
  }
}
