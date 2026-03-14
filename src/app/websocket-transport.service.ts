import { Injectable } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';
import { DapTransportService } from './dap-transport.service';
import { DapMessage, DapRequest, DapEvent } from './dap.types';

@Injectable()
export class WebSocketTransportService extends DapTransportService {
  private socket?: WebSocket;
  private messageSubject = new Subject<DapMessage>();
  private connectionStatusSubject = new Subject<boolean>();

  private static readonly INITIAL_BUFFER_CAPACITY = 4096;

  private buffer = new Uint8Array(WebSocketTransportService.INITIAL_BUFFER_CAPACITY); // 預分配初始容量
  private bufferLength = 0;             // buffer 中實際使用的位元組數
  private messageQueue: Promise<void> = Promise.resolve();

  override get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  override connect(address: string): Observable<void> {
    return new Observable<void>(observer => {
      // 重置狀態，避免舊連線的非同步操作污染新連線
      this.bufferLength = 0;
      this.messageQueue = Promise.resolve();

      // 若舊 socket 仍存在，清除其所有 handler 後關閉，防止記憶體洩漏與事件重複觸發
      if (this.socket) {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        this.socket.close();
        this.socket = undefined;
      }

      // 若沒有加上 ws:// 或 wss://，則預設加上 ws://
      const wsUrl = address.startsWith('ws') ? address : `ws://${address}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.connectionStatusSubject.next(true);
        observer.next();
        observer.complete();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        // 使用 Promise Queue 確保 WebSocket 事件依序被處理，避免 Blob 解析的非同步造成亂序
        this.messageQueue = this.messageQueue.then(async () => {
          try {
            if (event.data instanceof Blob) {
              const arrayBuffer = await event.data.arrayBuffer();
              let data = new Uint8Array(arrayBuffer);
              this.handleData(data);
            } else {
              this.messageSubject.error(new Error('Unsupported message data type'));
              return;
            }
          } catch (e) {
            console.error('Failed to process WebSocket message:', e);
          }
        });
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
    // 使用 TextEncoder 將 payload 轉為 Uint8Array 計算真實位元組長度
    const payloadBytes = new TextEncoder().encode(payload);
    const header = `Content-Length: ${payloadBytes.byteLength}\r\n\r\n`;

    // 陣列中直接合併字串與 Uint8Array 生成單一 Blob，避免字串被重複編碼
    this.socket.send(new Blob([header, payloadBytes], { type: 'application/json' }));
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
   * 處理來自 WebSocket 的資料流，基於 Uint8Array 解析，避免多位元組字元（例如中文）長度計算錯誤及截斷
   */
  private handleData(data: Uint8Array): void {
    // 將新接收到的 byte 以容量加倍策略寫入 buffer，避免每次都重新分配記憶體
    const required = this.bufferLength + data.length;
    if (required > this.buffer.length) {
      // 容量加倍直到足夠（攤銷 O(1) 的分配次數）
      let newCapacity = this.buffer.length || WebSocketTransportService.INITIAL_BUFFER_CAPACITY;
      while (newCapacity < required) newCapacity *= 2;
      const grown = new Uint8Array(newCapacity);
      grown.set(this.buffer.subarray(0, this.bufferLength), 0);
      this.buffer = grown;
    }
    this.buffer.set(data, this.bufferLength);
    this.bufferLength += data.length;

    while (this.bufferLength >= 14) {
      // DAP 訊息必須以 'Content-Length' 開頭 ('C' 的 ASCII 為 67)
      if (this.buffer[0] !== 67) {
        this.messageSubject.error(new Error(`Protocol error: DAP stream must start with 'Content-Length'. Received byte: ${this.buffer[0]}`));
        this.bufferLength = 0;
        break;
      }

      let headerEndIndex = -1;

      // 尋找 \r\n\r\n 作為 header 的結尾
      for (let i = 0; i < this.bufferLength - 3; i++) {
        if (this.buffer[i] === 13 && this.buffer[i + 1] === 10 &&
          this.buffer[i + 2] === 13 && this.buffer[i + 3] === 10) {
          headerEndIndex = i + 4;
          break;
        }
      }

      if (headerEndIndex === -1) {
        // 如果 Buffer 已經累積了一定長度卻還沒找到 Header 結尾 (\r\n\r\n)
        // 這通常代表協定錯誤或資料損毀
        if (this.bufferLength > 256) {
          this.messageSubject.error(new Error('DAP Header not found within 256 bytes of data'));
          this.bufferLength = 0;
        }
        break; // 等待更多資料
      }

      // 提取 Header 字串並解析 Content-Length
      const headerString = new TextDecoder().decode(this.buffer.subarray(0, headerEndIndex));
      //const headerString = new TextDecoder().decode(this.buffer.subarray(0, this.bufferLength));
      const headerMatch = headerString.match(/Content-Length: (\d+)/i);

      if (!headerMatch) {
        this.messageSubject.error(new Error(`Invalid DAP header without Content-Length: ${headerString}`));
        this.buffer.copyWithin(0, headerEndIndex, this.bufferLength);
        this.bufferLength -= headerEndIndex;
        continue;
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const totalLength = headerEndIndex + contentLength;

      // 如果尚未接收到足夠的 payload，則等待下個 chunk
      if (this.bufferLength < totalLength) {
        break;
      }

      // 擷取 JSON payload 並轉為字串
      const payloadBytes = this.buffer.subarray(headerEndIndex, totalLength);
      const payloadString = new TextDecoder().decode(payloadBytes);

      // 將剩餘資料移到 buffer 開頭，更新 bufferLength
      this.buffer.copyWithin(0, totalLength, this.bufferLength);
      this.bufferLength -= totalLength;

      try {
        const message = JSON.parse(payloadString) as DapMessage;
        this.messageSubject.next(message);
      } catch (e) {
        console.error('Failed to parse DAP message:', e, payloadString);
      }
    }
  }
}
