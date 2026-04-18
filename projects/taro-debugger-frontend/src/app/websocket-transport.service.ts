import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { DapTransportService } from './dap-transport.service';
import { DapMessage, DapRequest } from '@taro/dap-core';

@Injectable()
export class WebSocketTransportService extends DapTransportService {
  private socket?: WebSocket;
  private messageSubject = new Subject<DapMessage>();
  private connectionStatusSubject = new Subject<boolean>();

  private static readonly INITIAL_BUFFER_CAPACITY = 4096;

  private buffer = new Uint8Array(WebSocketTransportService.INITIAL_BUFFER_CAPACITY); // Pre-allocated initial capacity
  private bufferLength = 0;             // Actual number of bytes used in the buffer
  private messageQueue: Promise<void> = Promise.resolve();

  override get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  override connect(address: string): Observable<void> {
    return new Observable<void>(observer => {
      // Reset state to avoid asynchronous operations from old connections contaminating the new one
      this.bufferLength = 0;
      this.messageQueue = Promise.resolve();

      // If an old socket exists, clear all its handlers and close it to prevent memory leaks and duplicate event triggering
      if (this.socket) {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        this.socket.close();
        this.socket = undefined;
      }

      // Default to ws:// if ws:// or wss:// is not provided
      const wsUrl = address.startsWith('ws') ? address : `ws://${address}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.connectionStatusSubject.next(true);
        observer.next();
        observer.complete();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        // Use a Promise Queue to ensure WebSocket events are processed sequentially, 
        // avoiding out-of-order execution during asynchronous Blob parsing
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
        this.messageSubject.error(new Error('WebSocket connection error'));
        if (!observer.closed) observer.error(error);
      };

      this.socket.onclose = () => {
        this.connectionStatusSubject.next(false);
        this.messageSubject.complete();
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
    // Use TextEncoder to convert payload to Uint8Array for accurate byte length calculation
    const payloadBytes = new TextEncoder().encode(payload);
    const header = `Content-Length: ${payloadBytes.byteLength}\r\n\r\n`;

    // Merge string and Uint8Array directly in an array to generate a single Blob, avoiding redundant encoding
    this.socket.send(new Blob([header, payloadBytes], { type: 'application/json' }));
  }

  override onMessage(): Observable<DapMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Processes the data stream from WebSocket, parsing based on Uint8Array to avoid 
   * length calculation errors or truncation for multi-byte characters.
   */
  private handleData(data: Uint8Array): void {
    // Append newly received bytes to buffer using a capacity-doubling strategy to minimize memory reallocations
    const required = this.bufferLength + data.length;
    if (required > this.buffer.length) {
      // Double capacity until sufficient (amortized O(1) allocation frequency)
      let newCapacity = this.buffer.length || WebSocketTransportService.INITIAL_BUFFER_CAPACITY;
      while (newCapacity < required) newCapacity *= 2;
      const grown = new Uint8Array(newCapacity);
      grown.set(this.buffer.subarray(0, this.bufferLength), 0);
      this.buffer = grown;
    }
    this.buffer.set(data, this.bufferLength);
    this.bufferLength += data.length;

    while (this.bufferLength >= 14) {
      // DAP messages must start with 'Content-Length' ('C' ASCII is 67)
      if (this.buffer[0] !== 67) {
        this.messageSubject.error(new Error(`Protocol error: DAP stream must start with 'Content-Length'. Received byte: ${this.buffer[0]}`));
        this.bufferLength = 0;
        break;
      }

      let headerEndIndex = -1;

      // Find \r\n\r\n as the end of the header
      for (let i = 0; i < this.bufferLength - 3; i++) {
        if (this.buffer[i] === 13 && this.buffer[i + 1] === 10 &&
          this.buffer[i + 2] === 13 && this.buffer[i + 3] === 10) {
          headerEndIndex = i + 4;
          break;
        }
      }

      if (headerEndIndex === -1) {
        // If buffer has accumulated significant length without finding Header end (\r\n\r\n),
        // it usually indicates a protocol error or data corruption.
        if (this.bufferLength > 256) {
          this.messageSubject.error(new Error('DAP Header not found within 256 bytes of data'));
          this.bufferLength = 0;
        }
        break; // Wait for more data
      }

      // Extract Header string and parse Content-Length
      const headerString = new TextDecoder().decode(this.buffer.subarray(0, headerEndIndex));
      const headerMatch = headerString.match(/Content-Length: (\d+)/i);

      if (!headerMatch) {
        this.messageSubject.error(new Error(`Invalid DAP header without Content-Length: ${headerString}`));
        this.buffer.copyWithin(0, headerEndIndex, this.bufferLength);
        this.bufferLength -= headerEndIndex;
        continue;
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const totalLength = headerEndIndex + contentLength;

      // Wait for next chunk if the full payload has not been received
      if (this.bufferLength < totalLength) {
        break;
      }

      // Extract JSON payload and convert to string
      const payloadBytes = this.buffer.subarray(headerEndIndex, totalLength);
      const payloadString = new TextDecoder().decode(payloadBytes);

      // Move remaining data to the start of the buffer and update bufferLength
      this.buffer.copyWithin(0, totalLength, this.bufferLength);
      this.bufferLength -= totalLength;

      try {
        const message = JSON.parse(payloadString) as DapMessage;
        this.messageSubject.next(message);
      } catch (e: any) {
        console.error('Failed to parse DAP message:', e, payloadString);
        this.messageSubject.error(new Error(`DAP Protocol Error: Failed to parse JSON payload. ${e.message}`));
      }
    }
  }
}
