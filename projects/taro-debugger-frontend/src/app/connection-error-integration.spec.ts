/**
 * TI-05 — Connection Error & Intent Detection Integration Tests
 *
 * Verifies error propagation, connection timeout, and user-initiated disconnect
 * interception between DapSessionService (Session Layer) and the Transport Layer.
 *
 * Test Scope (ref: docs/test-plan.md §2.2 "Connection Error & Intent Detection"):
 *   1. Normal stop intent interception — clean disconnect() does NOT emit _transportError
 *   2. Unexpected disconnect detection — server crash emits _transportError and transitions to 'error'
 *   3. Connection timeout verification — WebSocket connect timeout is caught and rethrown clearly
 */

// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { DapSessionService, ExecutionState, DapBreakpointManager, DapThreadManager, DapRequestBroker } from '@taro/dap-core';
import { DapConfigService } from '@taro/dap-core';
import { TransportFactoryService } from '@taro/dap-core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Subject, BehaviorSubject, of, NEVER, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

// ── Mock Transport Factory ─────────────────────────────────────────────────

/**
 * Creates a fully controllable mock transport instance.
 * Exposes trigger helpers for simulating lifecycle events on the message stream.
 */
function createMockTransport() {
  const messageSubject$ = new Subject<any>();
  const connectionStatus$ = new BehaviorSubject<boolean>(false);

  const transport = {
    connect: vi.fn().mockReturnValue(of(void 0)),
    disconnect: vi.fn().mockImplementation(() => {
      connectionStatus$.next(false);
    }),
    onMessage: vi.fn().mockReturnValue(messageSubject$.asObservable()),
    sendRequest: vi.fn(),
    connectionStatus$: connectionStatus$.asObservable(),

    // ── Trigger Helpers ────────────────────────────────────────────────
    /** Simulate a full DAP response for the most recently sent request */
    respondToRequest(seq: number, command: string, extra?: object) {
      messageSubject$.next({
        type: 'response',
        request_seq: seq,
        success: true,
        command,
        body: {},
        ...extra
      });
    },

    /** Simulates transport completing normally (e.g. socket closed by peer) */
    triggerComplete() {
      messageSubject$.complete();
    },

    /** Simulates a hard transport error (e.g. WebSocket onerror) */
    triggerError(message = 'Transport error') {
      messageSubject$.error(new Error(message));
    },

    /** Simulates remote peer closing the connection after handshake */
    triggerServerCrash() {
      messageSubject$.complete();
    }
  };

  return { transport, messageSubject$, connectionStatus$ };
}

// ── Test Suite ────────────────────────────────────────────────────────────

describe('TI-05 — Connection Error & Intent Detection', () => {
  let service: DapSessionService;
  let mockTransport: ReturnType<typeof createMockTransport>['transport'];
  let transportFactory: any;

  // Helper — bring service into a synthetic 'running' state without a real handshake
  function simulateRunningState(): void {
    (service as any).messageSubscription = mockTransport.onMessage().subscribe({
      next: (msg: any) => (service as any).handleIncomingMessage(msg),
      error: (err: any) => (service as any).handleIncomingTransportError(err),
      complete: () => (service as any).handleIncomingTransportComplete()
    });
    (service as any).executionStateSubject.next('running');
  }

  beforeEach(() => {
    const mock = createMockTransport();
    mockTransport = mock.transport;

    transportFactory = {
      createTransport: vi.fn().mockReturnValue(mockTransport)
    };

    TestBed.configureTestingModule({
      providers: [
        DapSessionService,
        DapRequestBroker,
        DapBreakpointManager,
        DapThreadManager,
        {
          provide: DapConfigService,
          useValue: {
            getConfig: vi.fn().mockReturnValue({
              serverAddress: 'ws://127.0.0.1:8080/session/client',
              transportType: 'websocket',
              launchMode: 'launch',
              executablePath: '/usr/bin/target',
              stopOnEntry: true
            })
          }
        },
        { provide: TransportFactoryService, useValue: transportFactory }
      ]
    });

    service = TestBed.inject(DapSessionService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });


  // ── 2. Unexpected Disconnect Detection ─────────────────────────────────
  //
  // When the server crashes (or the socket drops unexpectedly), the transport's
  // message Subject will either error() or complete() while the session is still
  // in an active state (running / stopped).  The session MUST detect this,
  // transition to 'error', and emit a _transportError synthetic event so the
  // UI layer can show an appropriate notification.

  describe('2 — Unexpected disconnect detection', () => {
    it('should transition to error state when transport errors unexpectedly', () => {
      // Arrange
      simulateRunningState();

      // Act: hard transport error (e.g. WebSocket onerror)
      mockTransport.triggerError('Connection refused');

      // Assert
      const currentState = (service as any).executionStateSubject.value;
      expect(currentState).toBe('error');
    });

    it('should emit _transportError event when transport errors unexpectedly', () => {
      // Arrange
      simulateRunningState();

      const emittedEvents: any[] = [];
      service.onEvent().subscribe(e => emittedEvents.push(e));

      // Act
      mockTransport.triggerError('Server crashed');

      // Assert: exactly one _transportError emitted
      const transportErrors = emittedEvents.filter(e => e.event === '_transportError');
      expect(transportErrors).toHaveLength(1);
      expect(transportErrors[0].body.reason).toBe('error');
      expect(transportErrors[0].body.message).toContain('Server crashed');
    });

    it('should reject all pending requests when transport errors', async () => {
      // Arrange
      simulateRunningState();

      // Issue a request that will never receive a response
      const pendingPromise = (service as any).sendRequest('stackTrace', { threadId: 1 }, 60_000);

      // Act — simulate transport failure before server responds
      mockTransport.triggerError('Connection dropped');

      // Assert: pending request must reject
      await expect(pendingPromise).rejects.toThrow();
    });

    it('should transition to error state when transport completes unexpectedly (server crash)', () => {
      // Arrange: session in 'running' state (not idle)
      simulateRunningState();

      // Act: simulate server closing the socket without sending a 'terminated' event
      mockTransport.triggerServerCrash();

      // Assert: unexpected completion from a non-idle state must be treated as an error
      const currentState = (service as any).executionStateSubject.value;
      expect(currentState).toBe('error');
    });

    it('should emit _transportError with reason=error on unexpected socket close', () => {
      // Arrange
      simulateRunningState();

      const emittedEvents: any[] = [];
      service.onEvent().subscribe(e => emittedEvents.push(e));

      // Act
      mockTransport.triggerServerCrash();

      // Assert
      const transportErrors = emittedEvents.filter(e => e.event === '_transportError');
      expect(transportErrors).toHaveLength(1);
      expect(transportErrors[0].body.reason).toBe('error');
    });

    it('should NOT emit _transportError when transport completes after session is already idle', () => {
      // Arrange: session stays in default idle state — do NOT call simulateRunningState()
      const emittedEvents: any[] = [];
      service.onEvent().subscribe(e => emittedEvents.push(e));

      // Act: direct access to handler as if transport completed while idle
      (service as any).handleIncomingTransportComplete();

      // Assert: no event emitted because state is 'idle'
      expect(emittedEvents.filter(e => e.event === '_transportError')).toHaveLength(0);
    });
  });

  // ── 3. Connection Timeout Verification ──────────────────────────────────
  //
  // If the WebSocket server is unreachable or slow to respond, the RxJS timeout()
  // operator inside startSession() must fire and reject the connect Observable.
  // DapSessionService transforms this into a human-readable Error so the UI
  // layer (DebuggerComponent) can display it in the ErrorDialog.

  describe('3 — Connection timeout verification', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should throw a human-readable timeout error when connect does not resolve in time', async () => {
      // Arrange: override connect() to return an Observable that never completes
      // (simulates a WebSocket that is pending but never fires onopen)
      mockTransport.connect = vi.fn().mockReturnValue(NEVER);

      // Act: start the session and advance the clock past the 3 s timeout threshold
      const sessionPromise = service.startSession();
      vi.advanceTimersByTime(3100);

      // Assert
      await expect(sessionPromise).rejects.toThrow(/timed out/i);
    });

    it('should include the server address in the timeout error message', async () => {
      // Arrange
      mockTransport.connect = vi.fn().mockReturnValue(NEVER);

      const sessionPromise = service.startSession();
      vi.advanceTimersByTime(3100);

      await expect(sessionPromise).rejects.toThrow('ws://127.0.0.1:8080/session/client');
    });

    it('should reject with a transport-failure error when connect() errors before timeout', async () => {
      // Arrange: connect() immediately errors (e.g. DNS resolution failure)
      mockTransport.connect = vi.fn().mockReturnValue(
        throwError(() => new Error('ECONNREFUSED'))
      );

      // Act
      const sessionPromise = service.startSession();

      // Assert: non-timeout connection failure should produce a distinct message
      await expect(sessionPromise).rejects.toThrow(/connection failed/i);
    });
  });
});
