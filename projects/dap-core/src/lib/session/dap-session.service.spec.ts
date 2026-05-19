import { TestBed } from '@angular/core/testing';
import { DapSessionService, ExecutionState } from './dap-session.service';
import { DapConfigService } from './dap-config.service';
import { TransportFactoryService } from '../transport/transport-factory.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Subject, of, BehaviorSubject } from 'rxjs';

describe('DapSessionService', () => {
  let service: DapSessionService;
  let configService: any;
  let transportFactory: any;
  let mockTransport: any;
  let mockMessage$: Subject<any>;
  let mockConnectionStatus$: BehaviorSubject<boolean>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockMessage$ = new Subject<any>();
    mockConnectionStatus$ = new BehaviorSubject<boolean>(false);

    mockTransport = {
      connect: vi.fn().mockReturnValue(of(void 0)),
      disconnect: vi.fn(),
      onMessage: vi.fn().mockReturnValue(mockMessage$.asObservable()),
      sendRequest: vi.fn(),
      connectionStatus$: mockConnectionStatus$.asObservable()
    };

    transportFactory = {
      createTransport: vi.fn().mockReturnValue(mockTransport)
    };

    configService = {
      getConfig: vi.fn().mockReturnValue({
        serverAddress: 'ws://localhost:8080',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: true
      })
    };

    TestBed.configureTestingModule({
      providers: [
        DapSessionService,
        { provide: TransportFactoryService, useValue: transportFactory },
        { provide: DapConfigService, useValue: configService }
      ]
    });

    service = TestBed.inject(DapSessionService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Instruction Stepping', () => {
    it('should send next request with instruction granularity', async () => {
      (service as any).transport = mockTransport;
      service.nextInstruction();

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'next',
        arguments: { threadId: 1, granularity: 'instruction' }
      }));
    });

    it('should send stepIn request with instruction granularity', async () => {
      (service as any).transport = mockTransport;
      service.stepInInstruction();

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'stepIn',
        arguments: { threadId: 1, granularity: 'instruction' }
      }));
    });
  });

  describe('Sequence ID Management', () => {
    it('should increment seq for each request', () => {
      (service as any).transport = mockTransport;

      (service as any).sendRequest('command1');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 1 }));

      (service as any).sendRequest('command2');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 2 }));
    });
  });

  describe('Promise Mapping', () => {
    it('should resolve when matching response is received', async () => {
      (service as any).transport = mockTransport;

      const promise = (service as any).sendRequest('testCommand');

      // Manually trigger the handler
      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'testCommand',
        body: { result: 'ok' }
      });

      const response = await promise;
      expect(response.body.result).toBe('ok');
    });

    it('should reject when failed response is received', async () => {
      (service as any).transport = mockTransport;

      const promise = (service as any).sendRequest('testCommand');

      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: false,
        command: 'testCommand',
        message: 'Something went wrong'
      });

      await expect(promise).rejects.toThrow('Something went wrong');
    });

    it('should ignore responses with unknown request_seq', () => {
      (service as any).transport = mockTransport;

      // The session should emit a _sessionWarning event instead of logging directly
      const emittedEvents: any[] = [];
      (service as any).eventSubject.subscribe((e: any) => emittedEvents.push(e));

      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 999,
        success: true,
        command: 'unknown'
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('_sessionWarning');
      expect(emittedEvents[0].body.message).toContain('unknown request_seq=999');
    });
  });

  describe('Timeout Mechanism', () => {
    it('should reject on timeout', async () => {
      (service as any).transport = mockTransport;

      const promise = (service as any).sendRequest('slowCommand', {}, 100);

      vi.advanceTimersByTime(101);

      await expect(promise).rejects.toThrow(/timed out/);
    });
  });

  describe('Stop on Entry (WI-123)', () => {
    it('should send setFunctionBreakpoints(main) during session start if stopOnEntry is true', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://localhost:8080',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: true
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: req.command === 'initialize' ? { supportsFunctionBreakpoints: true } : {}
          });
        }, 0);
      });

      const sessionPromise = service.startSession();

      // Simulate initialized event
      setTimeout(() => {
        (service as any).handleIncomingMessage({ type: 'event', event: 'initialized', seq: 100 });
      }, 10);

      await vi.runAllTimersAsync();
      await sessionPromise;

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'setFunctionBreakpoints',
        arguments: {
          breakpoints: [{ name: 'main', condition: undefined }]
        }
      }));
    });

    it('should NOT send setFunctionBreakpoints if stopOnEntry is false', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://localhost:8080',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: false
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: {}
          });
        }, 0);
      });

      const sessionPromise = service.startSession();

      setTimeout(() => {
        (service as any).handleIncomingMessage({ type: 'event', event: 'initialized', seq: 100 });
      }, 10);

      await vi.runAllTimersAsync();
      await sessionPromise;

      expect(mockTransport.sendRequest).not.toHaveBeenCalledWith(expect.objectContaining({
        command: 'setFunctionBreakpoints'
      }));
    });

    it('should remove stopAtBeginningOfMainSubprogram from launch arguments', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://localhost:8080',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: true
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: {}
          });
        }, 0);
      });

      const sessionPromise = service.startSession();

      setTimeout(() => {
        (service as any).handleIncomingMessage({ type: 'event', event: 'initialized', seq: 100 });
      }, 10);

      await vi.runAllTimersAsync();
      await sessionPromise;

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'launch',
        arguments: expect.not.objectContaining({
          stopAtBeginningOfMainSubprogram: true
        })
      }));
    });

    it('should track system breakpoint IDs and update stop reason', async () => {
      (service as any).transport = mockTransport;

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: { breakpoints: [{ id: 500, verified: true }] }
          });
        }, 0);
      });

      const promise = service.setFunctionBreakpoints([{ name: 'main' }], true);
      vi.advanceTimersByTime(10);
      await promise;

      expect((service as any).systemBreakpointIds.has(500)).toBe(true);

      // 2. Simulate stop at this ID
      (service as any).handleIncomingMessage({
        type: 'event',
        event: 'stopped',
        body: {
          threadId: 1,
          reason: 'breakpoint',
          hitBreakpointIds: [500]
        }
      });

      expect((service as any).stopReasonSubject.value).toBe('Paused at entry (main)');
    });

    it('should ignore "breakpoint" events for system-managed breakpoints', async () => {
      (service as any).transport = mockTransport;

      // 1. Setup system breakpoint ID 500
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: { breakpoints: [{ id: 500, verified: true }] }
          });
        }, 0);
      });

      const promise = service.setFunctionBreakpoints([{ name: 'main' }], true);
      await vi.runAllTimersAsync();
      await promise;

      expect((service as any).systemBreakpointIds.has(500)).toBe(true);

      // 2. Simulate "breakpoint" event from adapter for ID 500
      // This often happens when symbolic breakpoints are bound to a line
      (service as any).handleIncomingMessage({
        type: 'event',
        event: 'breakpoint',
        body: {
          reason: 'changed',
          breakpoint: {
            id: 500,
            verified: true,
            line: 10,
            source: { path: '/src/main.c' }
          }
        }
      });

      // 3. Verify it is NOT in the public breakpoints observable
      const currentBps = (service as any).breakpointsSubject.value;
      expect(currentBps.has('/src/main.c')).toBe(false);
    });

    it('should ignore "breakpoint" events for system breakpoints even if they were initially unverified', async () => {
      (service as any).transport = mockTransport;

      // 1. Setup system breakpoint ID 600, initially UNVERIFIED
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: { breakpoints: [{ id: 600, verified: false }] } // Initially unverified
          });
        }, 0);
      });

      const promise = service.setFunctionBreakpoints([{ name: 'main' }], true);
      await vi.runAllTimersAsync();
      await promise;

      // Ensure ID was tracked despite being unverified
      expect((service as any).systemBreakpointIds.has(600)).toBe(true);

      // 2. Simulate "breakpoint" event where it becomes VERIFIED
      (service as any).handleIncomingMessage({
        type: 'event',
        event: 'breakpoint',
        body: {
          reason: 'changed',
          breakpoint: {
            id: 600,
            verified: true,
            line: 25,
            source: { path: '/src/init.c' }
          }
        }
      });

      // 3. Verify it is still hidden
      const currentBps = (service as any).breakpointsSubject.value;
      expect(currentBps.has('/src/init.c')).toBe(false);
    });
  });

  describe('Execution States', () => {
    it('should start with idle state', () => {
      expect((service as any).executionStateSubject.value).toBe('idle');
    });

    it('should transition through states based on events', () => {
      (service as any).handleTransportEvent({ type: 'event', event: 'stopped', seq: 1 });
      expect((service as any).executionStateSubject.value).toBe('stopped');

      (service as any).handleTransportEvent({ type: 'event', event: 'continued', seq: 2 });
      expect((service as any).executionStateSubject.value).toBe('running');

      (service as any).handleTransportEvent({ type: 'event', event: 'terminated', seq: 3 });
      expect((service as any).executionStateSubject.value).toBe('idle');
    });

    it('should transition to error on transport error', () => {
      (service as any).handleIncomingTransportError(new Error('connection lost'));
      expect((service as any).executionStateSubject.value).toBe('error');
    });

    it('should transition to error on transport completion if not idle', () => {
      (service as any).executionStateSubject.next('running');
      (service as any).handleIncomingTransportComplete();
      expect((service as any).executionStateSubject.value).toBe('error');
    });

    it('should stay in idle on transport completion if already idle', () => {
      // When a debuggee exits naturally, handleTransportEvent calls reset() which sets state to idle.
      // Subsequent transport completion (socket close) should not change this.
      (service as any).executionStateSubject.next('idle');
      (service as any).handleIncomingTransportComplete();
      expect((service as any).executionStateSubject.value).toBe('idle');
    });

    it('should transition to running upon successful continue request if allThreadsContinued is true', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('stopped');

      const promise = service.continue();

      // Simulate successful response (request_seq 1)
      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'continue',
        body: { allThreadsContinued: true }
      });

      await promise;
      expect((service as any).executionStateSubject.value).toBe('running');
    });



    it('should transition to running upon successful next request (instant feedback)', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('stopped');

      const promise = service.next();

      // Simulate successful response
      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'next'
      });

      await promise;
      expect((service as any).executionStateSubject.value).toBe('running');
      expect((service as any).commandInFlightSubject.value).toBe(false);
    });

    it('should recover from error state to idle via stop()', async () => {
      (service as any).executionStateSubject.next('error');
      await service.stop();
      expect((service as any).executionStateSubject.value).toBe('idle');
    });

    it('should recover from error state to idle via disconnect() without sending DAP request', async () => {
      (service as any).executionStateSubject.next('error');
      (service as any).transport = mockTransport;

      await service.disconnect();

      expect((service as any).executionStateSubject.value).toBe('idle');
      expect(mockTransport.sendRequest).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Thread State Tracking', () => {
    it('should track stopped threads in a Set', () => {
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint' }
      });
      const getStoppedIds = () => Array.from((service as any).stoppedThreadsSubject.value as Set<any>).map(t => t.id);
      expect(getStoppedIds()).toContain(1);
      expect((service as any).allThreadsStoppedSubject.value).toBe(false);

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 2, reason: 'step', allThreadsStopped: true }
      });
      expect(getStoppedIds()).toContain(1);
      expect(getStoppedIds()).toContain(2);
      expect((service as any).allThreadsStoppedSubject.value).toBe(true);
    });

    it('should remove thread IDs on per-thread continued event', () => {
      // Setup: two threads stopped
      const t1 = service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      const t2 = service.getOrCreateThreadObject({ id: 2, name: 'Thread 2' });
      (service as any).stoppedThreadsSubject.next(new Set([t1, t2]));
      (service as any).executionStateSubject.next('stopped');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: false }
      });

      const stoppedIds = Array.from((service as any).stoppedThreadsSubject.value as Set<any>).map(t => t.id);
      expect(stoppedIds).not.toContain(1);
      expect(stoppedIds).toContain(2);
      expect((service as any).executionStateSubject.value).toBe('stopped');
    });

    it('should clear all threads on allThreadsContinued event', () => {
      const t1 = service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      const t2 = service.getOrCreateThreadObject({ id: 2, name: 'Thread 2' });
      (service as any).stoppedThreadsSubject.next(new Set([t1, t2]));
      (service as any).allThreadsStoppedSubject.next(true);

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { allThreadsContinued: true }
      });

      expect((service as any).stoppedThreadsSubject.value.size).toBe(0);
      expect((service as any).allThreadsStoppedSubject.value).toBe(false);
      expect((service as any).executionStateSubject.value).toBe('running');
    });

    it('should transition to running if last stopped thread is continued', () => {
      const t1 = service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      (service as any).stoppedThreadsSubject.next(new Set([t1]));
      (service as any).executionStateSubject.next('stopped');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: false }
      });

      expect((service as any).stoppedThreadsSubject.value.size).toBe(0);
      expect((service as any).executionStateSubject.value).toBe('running');
    });

    it('should store and clear per-thread stop reasons', () => {
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint', description: 'Paused on breakpoint' }
      });

      expect((service as any).threadStopReasonsSubject.value.get(1)).toBe('Paused on breakpoint');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: false }
      });

      expect((service as any).threadStopReasonsSubject.value.has(1)).toBe(false);
    });

    it('should clear all stop reasons on allThreadsContinued', () => {
      (service as any).threadStopReasonsSubject.next(new Map([[1, 'reason1'], [2, 'reason2']]));

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { allThreadsContinued: true }
      });

      expect((service as any).threadStopReasonsSubject.value.size).toBe(0);
    });

    it('should transition to running when the last stopped thread exits (D2 regression)', () => {
      // Setup: one stopped thread
      const t1 = service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      (service as any).stoppedThreadsSubject.next(new Set([t1]));
      (service as any).executionStateSubject.next('stopped');
      (service as any).threadsSubject.next([t1]);

      // A 'thread exited' event fires instead of 'continued'
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'thread',
        body: { threadId: 1, reason: 'exited' }
      });

      // Advance virtual clock by 50ms to flush buffered thread events
      vi.advanceTimersByTime(50);

      // Thread removed from list
      expect((service as any).threadsSubject.value).toHaveLength(0);
      // stoppedThreads$ cleared
      expect((service as any).stoppedThreadsSubject.value.size).toBe(0);
      // Execution state must NOT remain stuck in 'stopped'
      expect((service as any).executionStateSubject.value).toBe('running');
      expect((service as any).allThreadsStoppedSubject.value).toBe(false);
    });
  });

  describe('ThreadObject Caching, Coalescing & Debouncing (WI-126)', () => {
    beforeEach(() => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('stopped');
    });

    it('should debounce thread started/exited events over a 50ms window', () => {
      // Fire multiple thread started events
      (service as any).handleTransportEvent({ type: 'event', event: 'thread', body: { threadId: 1, reason: 'started' } });
      (service as any).handleTransportEvent({ type: 'event', event: 'thread', body: { threadId: 2, reason: 'started' } });
      (service as any).handleTransportEvent({ type: 'event', event: 'thread', body: { threadId: 3, reason: 'started' } });

      // Verify no synchronous push
      expect((service as any).threadsSubject.value).toHaveLength(0);

      // Advance by 25ms, still no flush
      vi.advanceTimersByTime(25);
      expect((service as any).threadsSubject.value).toHaveLength(0);

      // Advance by remaining 25ms (50ms total), it flushes at once
      vi.advanceTimersByTime(25);
      expect((service as any).threadsSubject.value).toHaveLength(3);
      expect((service as any).threadsSubject.value[0].id).toBe(1);
      expect((service as any).threadsSubject.value[1].id).toBe(2);
      expect((service as any).threadsSubject.value[2].id).toBe(3);
    });

    it('should coalesce concurrent parallel stackTrace requests on the same thread', async () => {
      const threadObj = service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: 'stackTrace',
            body: { stackFrames: [{ id: 100, name: 'frame1' }] }
          });
        }, 10);
      });

      // Issue parallel calls
      const p1 = threadObj.stackTrace();
      const p2 = threadObj.stackTrace();

      vi.advanceTimersByTime(10);

      const [res1, res2] = await Promise.all([p1, p2]);

      // Assert: only one transport request sent
      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);
      expect(res1[0].name).toBe('frame1');
      expect(res2[0].name).toBe('frame1');
    });

    it('should cache stackTrace results and return them instantly on subsequent calls', async () => {
      const threadObj = service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: 'stackTrace',
            body: { stackFrames: [{ id: 100, name: 'frame1' }] }
          });
        }, 10);
      });

      // Call 1: fetches from network
      const p1 = threadObj.stackTrace();
      vi.advanceTimersByTime(10);
      const res1 = await p1;

      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);

      // Call 2: instant hit
      mockTransport.sendRequest.mockClear();
      const res2 = await threadObj.stackTrace();

      expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      expect(res2[0].name).toBe('frame1');
    });

    it('should invalidate cache when stepping or resumption occurs', async () => {
      const threadObj = service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: 'stackTrace',
            body: { stackFrames: [{ id: 100, name: 'frame1' }] }
          });
        }, 10);
      });

      // Populate cache
      const p1 = threadObj.stackTrace();
      vi.advanceTimersByTime(10);
      await p1;

      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);
      mockTransport.sendRequest.mockClear();

      // Trigger target step resumption
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: 'next'
          });
        }, 10);
      });
      const pNext = service.next();
      vi.advanceTimersByTime(10);
      await pNext;

      // Mock stackTrace response again for the next stop
      mockTransport.sendRequest.mockClear();
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: 'stackTrace',
            body: { stackFrames: [{ id: 200, name: 'frame2' }] }
          });
        }, 10);
      });

      // Now query stackTrace again
      const p2 = threadObj.stackTrace();
      vi.advanceTimersByTime(10);
      const res2 = await p2;

      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);
      expect(res2[0].name).toBe('frame2');
    });
  });

  describe('Command Serialization (R-CS1)', () => {
    it('should set commandInFlight$ to true during control command execution and reset on continued event', async () => {
      (service as any).transport = mockTransport;
      const promise = service.continue();

      expect((service as any).commandInFlightSubject.value).toBe(true);

      // Simulate adapter response (without allThreadsContinued — single thread)
      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'continue',
        body: { allThreadsContinued: true }
      });

      await promise;

      // Now simulate the 'continued' event from the adapter
      (service as any).handleTransportEvent({
        type: 'event', event: 'continued', seq: 2,
        body: { allThreadsContinued: true }
      });

      // Assert: commandInFlight is now released
      expect((service as any).commandInFlightSubject.value).toBe(false);
    });

    it('should drop second control command call while one is in-flight', async () => {
      (service as any).transport = mockTransport;

      // first call
      const promise1 = service.continue();
      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);

      // second call while in-flight
      const promise2 = service.next();
      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1); // Still 1

      const res2 = await promise2;
      expect(res2.success).toBe(true); // Silently successful but did nothing
      expect(res2.request_seq).toBe(0); // Dummy response

      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'continue'
      });

      await promise1;
    });
  });

  describe('Evaluate Cancellation (R-CS2)', () => {
    it('should send cancel request if capabilities support it', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('stopped');
      service.capabilities = { supportsCancelRequest: true };

      const promise = service.cancelRequest(5);

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cancel',
        arguments: { requestId: 5 }
      }));
    });

    it('should NOT send cancel request if capabilities do not support it', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('stopped');
      service.capabilities = { supportsCancelRequest: false };

      const promise = service.cancelRequest(5);

      expect(mockTransport.sendRequest).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'cancel' }));
    });

    it('should timeout evaluate request after 30s and reject with EvaluateCancelledError', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('stopped');
      service.capabilities = { supportsCancelRequest: true };

      const promise = service.evaluate('slow');

      // Fast forward 30 seconds
      vi.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow('Evaluate timed out');

      // The seq is 1
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cancel',
        arguments: { requestId: 1 }
      }));
    });
  });

  describe('Disconnect/Terminate One-Shot (R-CS5)', () => {
    it('should return immediately without sending a DAP request if state is already idle', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('idle');

      await service.disconnect();

      expect(mockTransport.sendRequest).not.toHaveBeenCalled();
    });


    it('should prevent double-call to disconnect from sending multiple requests', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('running');

      const p1 = service.disconnect();
      const p2 = service.disconnect();

      // Trigger response for the first request (seq 1)
      (service as any).handleIncomingMessage({
        type: 'response', request_seq: 1, command: 'disconnect', success: true
      });

      await Promise.all([p1, p2]);

      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ command: 'disconnect' }));
    });

  });

  describe('setBreakpoints Serialization (R-CS4)', () => {
    it('should send first setBreakpoints request immediately', async () => {
      (service as any).transport = mockTransport;
      const file = '/src/main.cpp';
      const p1 = service.setBreakpoints(file, [10, 20]);

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'setBreakpoints',
        arguments: expect.objectContaining({ source: { path: file }, breakpoints: [{ line: 10 }, { line: 20 }] })
      }));
    });

    it('should queue second call for same file and fire after first completes', async () => {
      (service as any).transport = mockTransport;
      const file = '/src/main.cpp';

      // 1. First call
      const p1 = service.setBreakpoints(file, [10]);
      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);

      // 2. Second call while first is in flight
      const p2 = service.setBreakpoints(file, [20]);
      // Should return empty array immediately and NOT send request yet
      const res2 = await p2;
      expect(res2).toEqual([]);
      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);

      // 3. Complete first call
      (service as any).handleIncomingMessage({
        type: 'response', request_seq: 1, command: 'setBreakpoints', success: true, body: { breakpoints: [{ line: 10, verified: true }] }
      });
      const res1 = await p1;
      expect(res1[0].line).toBe(10);

      // 4. Verification that second call fired automatically after first resolved
      // Since it's a recursive call triggered in finally, it sends a new request (seq 2).
      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(2);
      expect(mockTransport.sendRequest).toHaveBeenLastCalledWith(expect.objectContaining({
        command: 'setBreakpoints',
        arguments: expect.objectContaining({ breakpoints: [{ line: 20 }] })
      }));
    });

    it('should allow parallel calls for different files', async () => {
      (service as any).transport = mockTransport;
      const file1 = '/src/a.cpp';
      const file2 = '/src/b.cpp';

      service.setBreakpoints(file1, [1]);
      service.setBreakpoints(file2, [2]);

      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(2);
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        arguments: expect.objectContaining({ source: { path: file1 } })
      }));
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        arguments: expect.objectContaining({ source: { path: file2 } })
      }));
    });

    it('should implement last-write-wins for multiple pending requests', async () => {
      (service as any).transport = mockTransport;
      const file = '/src/main.cpp';

      service.setBreakpoints(file, [10]); // req 1
      service.setBreakpoints(file, [20]); // queues 20
      service.setBreakpoints(file, [30]); // overwrites 20 with 30

      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);

      // Complete first call (seq 1)
      (service as any).handleIncomingMessage({
        type: 'response', request_seq: 1, command: 'setBreakpoints', success: true
      });

      // Wait for tick (recursive microtask)
      await Promise.resolve();

      // Should have sent req for [30], skipping [20]
      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(2);
      expect(mockTransport.sendRequest).toHaveBeenLastCalledWith(expect.objectContaining({
        arguments: expect.objectContaining({ breakpoints: [{ line: 30 }] })
      }));
    });

    it('should only send enabled breakpoints to the DAP adapter', async () => {
      (service as any).transport = mockTransport;
      const file = '/src/main.cpp';

      // Mock transport to respond to setBreakpoints
      mockTransport.sendRequest.mockImplementation((req: any) => {
        if (req.command === 'setBreakpoints') {
          (service as any).handleIncomingMessage({
            type: 'response', request_seq: req.seq, command: 'setBreakpoints', success: true,
            body: { breakpoints: req.arguments.breakpoints.map((b: any) => ({ ...b, verified: true })) }
          });
        }
      });

      // 1. Manually set a disabled breakpoint in the map
      (service as any).breakpointsMap.set(file, [
        { line: 10, verified: true, enabled: true },
        { line: 20, verified: true, enabled: false }
      ]);

      // 2. Sync breakpoints (both 10 and 20 are requested by UI)
      await service.setBreakpoints(file, [10, 20]);

      // 3. Verify only line 10 (enabled) was sent to DAP
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'setBreakpoints',
        arguments: expect.objectContaining({
          breakpoints: [{ line: 10 }]
        })
      }));
    });

    it('should toggle enabled state and re-sync with DAP', async () => {
      (service as any).transport = mockTransport;
      const file = '/src/main.cpp';

      mockTransport.sendRequest.mockImplementation((req: any) => {
        if (req.command === 'setBreakpoints') {
          (service as any).handleIncomingMessage({
            type: 'response', request_seq: req.seq, command: 'setBreakpoints', success: true,
            body: { breakpoints: [] }
          });
        }
      });

      (service as any).breakpointsMap.set(file, [
        { line: 10, verified: true, enabled: true }
      ]);

      // Act: Toggle off
      await service.toggleBreakpointEnabled(file, 10);

      // Assert: Map updated and DAP sync triggered with EMPTY list for this file (as line 10 is now disabled)
      const bps = (service as any).breakpointsMap.get(file);
      expect(bps[0].enabled).toBe(false);
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'setBreakpoints',
        arguments: expect.objectContaining({ breakpoints: [] })
      }));
    });

    it('should remove breakpoint and re-sync with DAP', async () => {
      (service as any).transport = mockTransport;
      const file = '/src/main.cpp';

      mockTransport.sendRequest.mockImplementation((req: any) => {
        if (req.command === 'setBreakpoints') {
          (service as any).handleIncomingMessage({
            type: 'response', request_seq: req.seq, command: 'setBreakpoints', success: true,
            body: { breakpoints: req.arguments.breakpoints.map((b: any) => ({ ...b, verified: true })) }
          });
        }
      });

      (service as any).breakpointsMap.set(file, [
        { line: 10, verified: true, enabled: true },
        { line: 20, verified: true, enabled: true }
      ]);

      // Act: Remove line 10
      await service.removeBreakpoint(file, 10);

      // Assert: Line 10 removed from map, and DAP sync triggered with only line 20
      const bps = (service as any).breakpointsMap.get(file);
      expect(bps.length).toBe(1);
      expect(bps[0].line).toBe(20);
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'setBreakpoints',
        arguments: expect.objectContaining({ breakpoints: [{ line: 20 }] })
      }));
    });
  });

  describe('Stop and Restart Logic (WI-86)', () => {
    beforeEach(() => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('running');
    });

    describe('stop()', () => {
      it('should send terminate request if supported', async () => {
        (service as any).capabilities = { supportsTerminateRequest: true };

        const promise = service.stop();

        expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
          command: 'terminate'
        }));

        (service as any).handleIncomingMessage({
          type: 'response',
          request_seq: 1,
          success: true,
          command: 'terminate'
        });

        await promise;
      });

      it('should fallback to disconnect if terminate is NOT supported', async () => {
        (service as any).capabilities = { supportsTerminateRequest: false };

        const promise = service.stop();

        // Should NOT send terminate
        expect(mockTransport.sendRequest).not.toHaveBeenCalledWith(expect.objectContaining({
          command: 'terminate'
        }));

        // Should send disconnect with terminateDebuggee: true
        expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
          command: 'disconnect',
          arguments: expect.objectContaining({ terminateDebuggee: true })
        }));

        (service as any).handleIncomingMessage({
          type: 'response',
          request_seq: 1,
          success: true,
          command: 'disconnect'
        });

        await promise;
      });

      it('should fallback to disconnect if terminate fails', async () => {
        (service as any).capabilities = { supportsTerminateRequest: true };

        const promise = service.stop();

        expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
          command: 'terminate'
        }));

        // Simulate failure
        (service as any).handleIncomingMessage({
          type: 'response',
          request_seq: 1,
          success: false,
          command: 'terminate',
          message: 'Failed'
        });

        // Wait for microtask (catch block)
        await Promise.resolve();

        // Should then call disconnect
        expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
          command: 'disconnect',
          arguments: expect.objectContaining({ terminateDebuggee: true })
        }));

        (service as any).handleIncomingMessage({
          type: 'response',
          request_seq: 2,
          success: true,
          command: 'disconnect'
        });

        await promise;
      });

      it('should return early if state is idle', async () => {
        (service as any).executionStateSubject.next('idle');
        await service.stop();
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });
    });

    describe('restart()', () => {
      it('should send restart request if supported', async () => {
        (service as any).capabilities = { supportsRestartRequest: true };

        const promise = service.restart();

        expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
          command: 'restart'
        }));

        (service as any).handleIncomingMessage({
          type: 'response',
          request_seq: 1,
          success: true,
          command: 'restart'
        });

        await promise;
      });


      it('should NOT allow restart from idle state (Run is preferred)', async () => {
        (service as any).executionStateSubject.next('idle');
        const startSessionSpy = vi.spyOn(service, 'startSession').mockResolvedValue({} as any);

        await service.restart();

        expect(startSessionSpy).not.toHaveBeenCalled();
      });

      it('should call stop() before disconnect during soft restart from running state', async () => {
        (service as any).capabilities = { supportsRestartRequest: false };
        (service as any).executionStateSubject.next('running');
        const stopSpy = vi.spyOn(service, 'stop').mockResolvedValue(undefined);
        const disconnectSpy = vi.spyOn(service as any, 'disconnect').mockResolvedValue(undefined);
        const startSessionSpy = vi.spyOn(service, 'startSession').mockResolvedValue({} as any);

        await service.restart();

        expect(stopSpy).toHaveBeenCalled();
        expect(disconnectSpy).toHaveBeenCalledWith(expect.objectContaining({ restart: true }));
        expect(startSessionSpy).toHaveBeenCalled();
      });

      it('should call stop() before disconnect during soft restart from stopped state', async () => {
        (service as any).capabilities = { supportsRestartRequest: false };
        (service as any).executionStateSubject.next('stopped');
        const stopSpy = vi.spyOn(service, 'stop').mockResolvedValue(undefined);
        const disconnectSpy = vi.spyOn(service as any, 'disconnect').mockResolvedValue(undefined);
        const startSessionSpy = vi.spyOn(service, 'startSession').mockResolvedValue({} as any);

        await service.restart();

        expect(stopSpy).toHaveBeenCalled();
        expect(disconnectSpy).toHaveBeenCalledWith(expect.objectContaining({ restart: true }));
        expect(startSessionSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Breakpoint Events', () => {
    it('should update breakpoint state when changed event is received', () => {
      (service as any).breakpointsMap.set('/main.c', [
        { line: 10, verified: false, enabled: true, id: 1 }
      ]);

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'breakpoint',
        body: {
          reason: 'changed',
          breakpoint: {
            id: 1,
            verified: true,
            line: 10,
            source: { path: '/main.c' }
          }
        }
      });

      const bps = (service as any).breakpointsMap.get('/main.c');
      expect(bps[0].verified).toBe(true);
    });

    it('should remove breakpoint when removed event is received', () => {
      (service as any).breakpointsMap.set('/main.c', [
        { line: 10, verified: true, enabled: true, id: 1 },
        { line: 20, verified: true, enabled: true, id: 2 }
      ]);

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'breakpoint',
        body: {
          reason: 'removed',
          breakpoint: {
            id: 1,
            line: 10,
            source: { path: '/main.c' }
          }
        }
      });

      const bps = (service as any).breakpointsMap.get('/main.c');
      expect(bps).toHaveLength(1);
      expect(bps[0].id).toBe(2);
    });
  });

  describe('High-level DAP Methods', () => {
    it('should send loadedSources request', async () => {
      (service as any).transport = mockTransport;
      service.loadedSources();

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'loadedSources'
      }));
    });

    it('should send source request with arguments', async () => {
      (service as any).transport = mockTransport;
      service.source({ sourceReference: 42, source: { path: '/test.cpp' } });

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'source',
        arguments: { sourceReference: 42, source: { path: '/test.cpp' } }
      }));
    });
  });

  // ── Execution State & Thread Context ─────────────────────────────

  describe('State Transition Guard', () => {
    it('should emit _sessionError and unlock commandInFlight if no state event arrives within 5s', async () => {
      // Arrange: mock the internal sendRequest directly on the service
      // so the transport-level 5s request timeout doesn't interfere
      const emittedEvents: any[] = [];
      service.onEvent().subscribe(e => emittedEvents.push(e));

      // Stub sendRequest to return a never-resolving promise (simulates adapter silent drop)
      vi.spyOn(service as any, 'sendRequest').mockReturnValue(new Promise(() => { }));

      // Act: trigger next() — this arms the state transition guard
      service.next();
      expect((service as any).commandInFlightSubject.value).toBe(true);

      // Advance exactly 5 seconds — the state transition guard fires
      vi.advanceTimersByTime(5000);

      // Assert: UI is unlocked and a _sessionError was emitted
      expect((service as any).commandInFlightSubject.value).toBe(false);
      const errorEvent = emittedEvents.find(e => e.event === '_sessionError');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.body.message).toContain('next');
      expect(errorEvent.body.message).toContain('5000ms');
    });

    it('should clear the transition guard when a stopped event arrives before timeout', async () => {
      // Arrange: stub sendRequest so next() doesn't create a conflicting timer
      vi.spyOn(service as any, 'sendRequest').mockReturnValue(new Promise(() => { }));
      // Stub fetchThreads so the stopped event doesn't attempt a real request
      vi.spyOn(service as any, 'fetchThreads').mockResolvedValue(undefined);

      const emittedEvents: any[] = [];
      service.onEvent().subscribe(e => emittedEvents.push(e));

      service.next();

      // Act: stopped event arrives at t=2s (before 5s guard)
      (service as any).handleTransportEvent({
        type: 'event', event: 'stopped', seq: 1,
        body: { threadId: 1, allThreadsStopped: true }
      });

      // Advance past the 5s mark — the guard should already be cleared
      vi.advanceTimersByTime(6000);

      // Assert: UI is unlocked, timer cleared, and NO _sessionError was emitted
      expect((service as any).commandInFlightSubject.value).toBe(false);
      expect((service as any).stateTransitionTimer).toBeUndefined();
      const errorEvent = emittedEvents.find(e => e.event === '_sessionError');
      expect(errorEvent).toBeUndefined();
    });
  });

  describe('Optimistic Running Transition', () => {
    it('should immediately transition to running when continue() response has allThreadsContinued: true', async () => {
      // Arrange: mock the private sendRequest to simulate an adapter responding with allThreadsContinued
      (service as any).executionStateSubject.next('stopped');
      (service as any).activeThreadSubject.next({ id: 3 } as any);

      let resolveRequest!: (v: any) => void;
      vi.spyOn(service as any, 'sendRequest').mockReturnValue(
        new Promise(resolve => { resolveRequest = resolve; })
      );

      const continuePromise = service.continue();
      expect((service as any).commandInFlightSubject.value).toBe(true);

      // Act: adapter responds with allThreadsContinued: true
      resolveRequest({ success: true, body: { allThreadsContinued: true } });
      await continuePromise;

      // Assert: optimistic running state applied and UI unlocked immediately
      expect((service as any).executionStateSubject.value).toBe('running');
      expect((service as any).stoppedThreadsSubject.value.size).toBe(0);
      expect((service as any).commandInFlightSubject.value).toBe(false);
    });


  });

  describe('Active Thread Auto-Selection', () => {
    it('should auto-select first stopped thread when stopped event omits threadId and no thread is active', () => {
      // Arrange: no active thread set
      (service as any).activeThreadSubject.next(null);

      // Simulate allThreadsStopped with multiple stopped threads but no explicit threadId
      const t5 = service.getOrCreateThreadObject({ id: 5, name: 'Thread 5' });
      const t7 = service.getOrCreateThreadObject({ id: 7, name: 'Thread 7' });
      const t9 = service.getOrCreateThreadObject({ id: 9, name: 'Thread 9' });
      (service as any).stoppedThreadsSubject.next(new Set([t5, t7, t9]));

      // Act: stopped event with allThreadsStopped=true but no threadId
      (service as any).handleTransportEvent({
        type: 'event', event: 'stopped', seq: 1,
        body: { allThreadsStopped: true }
      });

      // Assert: first thread from the set was auto-selected
      const activeId = (service as any).activeThreadSubject.value?.id;
      expect([5, 7, 9]).toContain(activeId);
    });

    it('should not override an existing active thread when stopped event omits threadId', () => {
      // Arrange: active thread is already set to 7
      (service as any).activeThreadSubject.next(service.getOrCreateThreadObject({ id: 7, name: 'Thread 7' }));
      const t5 = service.getOrCreateThreadObject({ id: 5, name: 'Thread 5' });
      const t7 = service.getOrCreateThreadObject({ id: 7, name: 'Thread 7' });
      const t9 = service.getOrCreateThreadObject({ id: 9, name: 'Thread 9' });
      (service as any).stoppedThreadsSubject.next(new Set([t5, t7, t9]));

      // Act: stopped event with no explicit threadId
      (service as any).handleTransportEvent({
        type: 'event', event: 'stopped', seq: 1,
        body: { allThreadsStopped: true }
      });

      // Assert: original active thread preserved
      expect((service as any).activeThreadSubject.value?.id).toBe(7);
    });

    it('should update activeThreadId to the specified threadId in a stopped event', () => {
      // Arrange
      (service as any).activeThreadSubject.next(service.getOrCreateThreadObject({ id: 1, name: 'Thread 1' }));

      // Act: stopped event with explicit threadId=12
      (service as any).handleTransportEvent({
        type: 'event', event: 'stopped', seq: 1,
        body: { threadId: 12, allThreadsStopped: false }
      });

      // Assert: active thread updated to the one reported by the adapter
      expect((service as any).activeThreadSubject.value?.id).toBe(12);
    });
  });
});
