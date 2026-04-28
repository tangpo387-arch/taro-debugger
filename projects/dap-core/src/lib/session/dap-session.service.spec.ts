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
        executablePath: '/path/to/exe'
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

  describe('Execution State Transitions', () => {
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

    it('should optimistically transition to running upon successful continue request', async () => {
      (service as any).transport = mockTransport;
      (service as any).executionStateSubject.next('stopped');

      const promise = service.continue();

      // Simulate successful response (request_seq 1)
      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'continue'
      });

      await promise;
      expect((service as any).executionStateSubject.value).toBe('running');
    });
  });

  describe('Command Serialization (R-CS1)', () => {
    it('should set commandInFlight$ to true during control command execution', async () => {
      (service as any).transport = mockTransport;
      const promise = service.continue();

      expect((service as any).commandInFlightSubject.value).toBe(true);

      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'continue'
      });

      await promise;
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
});
