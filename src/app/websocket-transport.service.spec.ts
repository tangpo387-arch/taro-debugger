// @vitest-environment jsdom
import { WebSocketTransportService } from './websocket-transport.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';

// ── Mock WebSocket Class ────────────────────────────────────────────────────
// Captures itself as the latest instance for test access.
// The service assigns event handlers (onopen, onmessage, etc.) as properties
// after construction, so they are always accessible via `latestSocket`.
// Module-level bridge written by MockWebSocket constructor.
// The describe-scoped `latestSocket` is kept in sync in beforeEach.
let _lastCreatedSocket: MockWebSocket;


class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();
  // Handlers assigned by the service after construction
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;

  constructor(public url: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    _lastCreatedSocket = this;
  }

  /** Helper — fires onopen synchronously */
  triggerOpen(): void {
    this.onopen?.({});
  }

  /** Helper — fires onmessage with a Blob containing `data` */
  async triggerMessage(data: string): Promise<void> {
    const blob = new Blob([data]);
    this.onmessage?.({ data: blob } as MessageEvent);
    // Drain the internal Promise queue used by the service
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  /** Helper — fires onmessage with a non-Blob value (error path) */
  async triggerRawMessage(data: unknown): Promise<void> {
    this.onmessage?.({ data } as MessageEvent);
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  /** Helper — fires onclose */
  triggerClose(): void {
    this.onclose?.({});
  }

  /** Helper — fires onerror */
  triggerError(msg = 'test error'): void {
    this.onerror?.(new Error(msg));
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a valid DAP-framed string for the given payload object.
 */
function buildPacket(payload: object): string {
  const json = JSON.stringify(payload);
  const byteLen = new TextEncoder().encode(json).byteLength;
  return `Content-Length: ${byteLen}\r\n\r\n${json}`;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('WebSocketTransportService', () => {
  let service: WebSocketTransportService;
  // Declared inside describe to prevent cross-test contamination
  let latestSocket: MockWebSocket;

  /** Subscribe to connect() and sync latestSocket with the newly created socket. */
  function connectService(address = 'localhost:4711'): void {
    service.connect(address).subscribe();
    latestSocket = _lastCreatedSocket;
  }

  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    service = new WebSocketTransportService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Connection Management ──────────────────────────────────────────────

  describe('Connection Management', () => {
    it('should prepend ws:// if no protocol is given', async () => {
      connectService('localhost:4711');
      expect(latestSocket.url).toBe('ws://localhost:4711');
    });

    it('should keep ws:// prefix when provided', async () => {
      connectService('ws://custom:8080');
      expect(latestSocket.url).toBe('ws://custom:8080');
    });

    it('should keep wss:// prefix when provided', async () => {
      connectService('wss://secure:443');
      expect(latestSocket.url).toBe('wss://secure:443');
    });

    it('should resolve the connect Observable when onopen fires', async () => {
      const connectPromise = firstValueFrom(service.connect('localhost:4711'));
      latestSocket = _lastCreatedSocket;
      latestSocket.triggerOpen();
      await expect(connectPromise).resolves.toBeUndefined();
    });

    it('should reject the connect Observable when onerror fires before onopen', async () => {
      const connectPromise = firstValueFrom(service.connect('bad-host:1')).catch(e => e);
      latestSocket = _lastCreatedSocket;
      latestSocket.triggerError('Connection refused');
      const err = await connectPromise;
      expect(err).toBeDefined();
    });

    it('should emit true on connectionStatus$ when connection opens', async () => {
      const statusPromise = firstValueFrom(service.connectionStatus$.pipe(take(1)));
      connectService();
      latestSocket.triggerOpen();
      expect(await statusPromise).toBe(true);
    });

    it('should emit false on connectionStatus$ when connection closes', async () => {
      connectService();
      latestSocket.triggerOpen();

      const statusPromise = firstValueFrom(service.connectionStatus$.pipe(take(1)));
      latestSocket.triggerClose();
      expect(await statusPromise).toBe(false);
    });

    it('should emit false on connectionStatus$ when connection errors', async () => {
      connectService();
      latestSocket.triggerOpen();

      const statusPromise = firstValueFrom(service.connectionStatus$.pipe(take(1)));
      latestSocket.triggerError();
      expect(await statusPromise).toBe(false);
    });

    it('should close old socket on reconnect', () => {
      connectService();
      const firstSocket = latestSocket;

      connectService();
      expect(firstSocket.close).toHaveBeenCalled();
    });

    it('should close socket and emit false on disconnect()', async () => {
      connectService();
      latestSocket.triggerOpen();

      const statusPromise = firstValueFrom(service.connectionStatus$.pipe(take(1)));
      service.disconnect();

      expect(latestSocket.close).toHaveBeenCalled();
      expect(await statusPromise).toBe(false);
    });
  });

  // ── Message Parsing (Success) ──────────────────────────────────────────

  describe('Message Parsing (Success)', () => {
    beforeEach(() => {
      connectService();
      latestSocket.triggerOpen();
    });

    it('should parse a single valid DAP packet', async () => {
      const msgPromise = firstValueFrom(service.onMessage().pipe(take(1)));
      await latestSocket.triggerMessage(buildPacket({ seq: 1, type: 'event', event: 'initialized' }));
      const msg = await msgPromise;
      expect(msg).toEqual({ seq: 1, type: 'event', event: 'initialized' });
    });

    it('should parse two packets sent in a single onmessage event (sticky packet)', async () => {
      const msgsPromise = firstValueFrom(service.onMessage().pipe(take(2), toArray()));
      const combined = buildPacket({ seq: 1, type: 'event', event: 'e1' })
                     + buildPacket({ seq: 2, type: 'event', event: 'e2' });
      await latestSocket.triggerMessage(combined);
      const msgs = await msgsPromise;
      expect(msgs).toHaveLength(2);
      expect(msgs[0].seq).toBe(1);
      expect(msgs[1].seq).toBe(2);
    });

    it('should reassemble a packet whose header arrives in two chunks', async () => {
      const msgPromise = firstValueFrom(service.onMessage().pipe(take(1)));
      const packet = buildPacket({ seq: 3, type: 'event', event: 'halfHeader' });
      // Split inside the header line, before \r\n\r\n
      const splitAt = 10;
      await latestSocket.triggerMessage(packet.slice(0, splitAt));
      await latestSocket.triggerMessage(packet.slice(splitAt));
      expect((await msgPromise).seq).toBe(3);
    });

    it('should reassemble a packet whose body arrives in two chunks', async () => {
      const msgPromise = firstValueFrom(service.onMessage().pipe(take(1)));
      const packet = buildPacket({ seq: 4, type: 'event', event: 'halfBody' });
      // Split inside the JSON body (after header)
      const headerEnd = packet.indexOf('\r\n\r\n') + 4;
      const splitAt = headerEnd + 3;
      await latestSocket.triggerMessage(packet.slice(0, splitAt));
      await latestSocket.triggerMessage(packet.slice(splitAt));
      expect((await msgPromise).seq).toBe(4);
    });

    it('should handle payloads larger than INITIAL_BUFFER_CAPACITY (4 KB)', async () => {
      const longString = 'x'.repeat(5000);
      const msgPromise = firstValueFrom(service.onMessage().pipe(take(1)));
      await latestSocket.triggerMessage(buildPacket({ seq: 5, type: 'event', data: longString }));
      const msg = (await msgPromise as unknown) as Record<string, unknown>;
      expect(msg['data']).toBe(longString);
    });

    it('should correctly decode multi-byte UTF-8 content', async () => {
      const text = '你好, world 🌍';
      const msgPromise = firstValueFrom(service.onMessage().pipe(take(1)));
      await latestSocket.triggerMessage(buildPacket({ seq: 6, type: 'event', text }));
      const msg = (await msgPromise as unknown) as Record<string, unknown>;
      expect(msg['text']).toBe(text);
    });
  });

  // ── Error Handling (Fail-Fast) ─────────────────────────────────────────

  describe('Error Handling (Fail-Fast)', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      connectService();
      latestSocket.triggerOpen();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should error when stream does not start with "Content-Length"', async () => {
      const errPromise = firstValueFrom(service.onMessage()).catch((e: Error) => e);
      await latestSocket.triggerMessage('Invalid-Header: ...');
      const err = await errPromise;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain(
        "Protocol error: DAP stream must start with 'Content-Length'"
      );
    });

    it('should error when \\r\\n\\r\\n delimiter is missing after 256 bytes', async () => {
      const errPromise = firstValueFrom(service.onMessage()).catch((e: Error) => e);
      // Valid prefix but no delimiter, exceeds 256 bytes
      await latestSocket.triggerMessage('Content-Length: 0' + ' '.repeat(300));
      const err = await errPromise;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('DAP Header not found within 256 bytes');
    });

    it('should error when the JSON body is malformed', async () => {
      const errPromise = firstValueFrom(service.onMessage()).catch((e: Error) => e);
      // Content-Length of 9 declared but body is not valid JSON
      await latestSocket.triggerMessage('Content-Length: 9\r\n\r\n{bad json}');
      const err = await errPromise;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('DAP Protocol Error: Failed to parse JSON payload');
    });

    it('should error when onmessage receives non-Blob data', async () => {
      const errPromise = firstValueFrom(service.onMessage()).catch((e: Error) => e);
      await latestSocket.triggerRawMessage('plain-string');
      const err = await errPromise;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('Unsupported message data type');
    });
  });
});
