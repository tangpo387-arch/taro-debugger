/**
 * @file transport-mock.example.ts
 * @description DAP Transport layer mock pattern for testing DapSessionService itself.
 *
 * Usage:
 *   Use this pattern when the target under test IS `DapSessionService` and you need to
 *   simulate raw incoming DAP messages (events, responses) from the transport layer.
 *
 *   For testing anything ABOVE DapSessionService (components, derived services),
 *   use `service.spec.example.ts` instead — mock DapSessionService directly.
 */

import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Replace with your actual imports ──────────────────────────────────────────
import { DapSessionService } from './dap-session.service';
import { WebSocketTransportService } from './websocket-transport.service';

// ── Transport Mock Factory ────────────────────────────────────────────────────
// Use a Subject to manually push raw DAP messages into DapSessionService.
// Each test gets a fresh Subject and a fresh mock transport instance.

function makeTransportMock() {
  const message$ = new Subject<unknown>();
  const mock = {
    connect: vi.fn().mockReturnValue(of(void 0)),
    disconnect: vi.fn(),
    onMessage: () => message$.asObservable(),
    send: vi.fn(),
  };
  return { mock, message$ };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('DapSessionService (via transport mock)', () => {
  let service: DapSessionService;
  let message$: Subject<unknown>;

  beforeEach(() => {
    const { mock, message$: msg$ } = makeTransportMock();
    message$ = msg$;

    TestBed.configureTestingModule({
      providers: [
        DapSessionService,
        { provide: WebSocketTransportService, useValue: mock },
      ],
    });

    service = TestBed.inject(DapSessionService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ── Pushing synthetic DAP events ───────────────────────────────────────────

  it('should transition executionState to "stopped" on a stopped event', async () => {
    // Arrange
    await service.connect('ws://localhost:4711');

    // Act — push a raw DAP stopped event through the transport Subject
    message$.next({
      type: 'event',
      event: 'stopped',
      body: { reason: 'breakpoint', threadId: 1 },
    });

    // Assert
    expect(service.executionState$.getValue()).toBe('stopped');
  });

  // ── Pushing synthetic DAP responses ───────────────────────────────────────

  it('should resolve sendRequest Promise when a matching response arrives', async () => {
    // Arrange
    await service.connect('ws://localhost:4711');
    const requestPromise = service.sendRequest('stackTrace', { threadId: 1 });

    // Act — push the matching response (seq must correspond to the request seq)
    message$.next({
      type: 'response',
      request_seq: 1, // adjust to match the actual seq counter
      success: true,
      command: 'stackTrace',
      body: { stackFrames: [] },
    });

    // Assert
    const result = await requestPromise;
    expect(result.success).toBe(true);
    expect(result.body.stackFrames).toEqual([]);
  });

  // ── Transport error simulation ─────────────────────────────────────────────

  it('should transition executionState to "error" when transport errors', () => {
    // Act — complete the Subject with an error to simulate unexpected disconnect
    message$.error(new Error('WebSocket closed unexpectedly'));

    // Assert
    expect(service.executionState$.getValue()).toBe('error');
  });
});
