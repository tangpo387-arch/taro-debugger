import { TestBed } from '@angular/core/testing';
import { DapSessionService, DapFatalException, ExecutionState } from './dap-session.service';
import { DapConfigService } from './dap-config.service';
import { TransportFactoryService } from '../transport/transport-factory.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Subject, of, BehaviorSubject } from 'rxjs';
import { DapBreakpointManager } from './dap-breakpoint-manager.service';
import { DapThreadManager } from './dap-thread-manager.service';
import { DapRequestBroker } from './dap-request-broker.service';

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
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: true,
        sessionPath: '.tarodb'
      }),
      setConfig: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        DapSessionService,
        DapRequestBroker,
        DapBreakpointManager,
        DapThreadManager,
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
      (service as any).executionStateSubject.next('stopped');
      service.nextInstruction();

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'next',
        arguments: { threadId: 1, granularity: 'instruction' }
      }));
    });

    it('should send stepIn request with instruction granularity', async () => {
      (service as any).executionStateSubject.next('stopped');
      service.stepInInstruction();

      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'stepIn',
        arguments: { threadId: 1, granularity: 'instruction' }
      }));
    });
  });

  describe('Sequence ID Management', () => {
    it('should increment seq for each request', () => {
      (service as any).sendRequest('command1');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 1 }));

      (service as any).sendRequest('command2');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 2 }));
    });
  });

  describe('Promise Mapping', () => {
    it('should resolve when matching response is received', async () => {
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
      const promise = (service as any).sendRequest('slowCommand', {}, 100);

      vi.advanceTimersByTime(101);

      await expect(promise).rejects.toThrow(/timed out/);
    });
  });

  // ── Setup Handshake (WI-136) ───────────────────────────────────────────────

  describe('Setup Handshake (WI-136)', () => {
    /**
     * Shared helper: configures mockTransport.sendRequest to respond in order:
     *  1. setup channel → session-ready
     *  2. all other requests → success response
     * Also fires the 'initialized' DAP event after a short delay.
     */
    function wireFullStartSession(sessionReadyBody: object = {}): void {
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          if (req.channel === 'setup') {
            (service as any).handleIncomingMessage({
              channel: 'setup',
              event: 'session-ready',
              body: sessionReadyBody
            });
            return;
          }
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: req.command === 'initialize'
              ? { supportsTerminateRequest: true }
              : {}
          });
        }, 0);
      });

      // Emit 'initialized' event after DAP initialize completes
      setTimeout(() => {
        (service as any).handleIncomingMessage({ type: 'event', event: 'initialized', seq: 100 });
      }, 10);
    }

    it('should send open-session on the setup channel before DAP initialize', async () => {
      // Arrange — wire the full session flow via shared helper
      wireFullStartSession({
        status: 'success',
        sessionPath: '.tarodb',
        config: { configuration: { program: '/exe', args: [], cwd: '/root' } }
      });

      // Act
      const sessionPromise = service.startSession();
      await vi.runAllTimersAsync();
      await sessionPromise;

      // Assert — open-session must be the very first sendRequest call
      const calls = mockTransport.sendRequest.mock.calls;
      const firstCall = calls[0][0];
      expect(firstCall).toMatchObject({ channel: 'setup', command: 'open-session' });

      // Assert — initialize must follow open-session
      const openSessionIndex = calls.findIndex(
        (args: any[]) => args[0].channel === 'setup' && args[0].command === 'open-session'
      );
      const initializeIndex = calls.findIndex(
        (args: any[]) => args[0].command === 'initialize'
      );
      expect(initializeIndex).toBeGreaterThan(-1);
      expect(openSessionIndex).toBeLessThan(initializeIndex);
    });

    it('should merge session-ready config into DapConfigService', async () => {
      // Arrange
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '',
        stopOnEntry: false,
        sessionPath: '/my/session.tarodb'
      });

      const backendConfig = {
        program: '/usr/bin/myapp',
        args: ['--verbose', '--port=8080'],
        cwd: '/workspace/project'
      };

      wireFullStartSession({
        status: 'success',
        sessionPath: '/my/session.tarodb',
        config: { configuration: backendConfig }
      });

      // Act
      const sessionPromise = service.startSession();
      await vi.runAllTimersAsync();
      await sessionPromise;

      // Assert — setConfig must have been called with the backend-provided values
      expect(configService.setConfig).toHaveBeenCalledWith(expect.objectContaining({
        executablePath: '/usr/bin/myapp',
        sourcePath: '/workspace/project',
        programArgs: '--verbose --port=8080'
      }));
    });

    it('should send new-session on the setup channel when setupMode is new', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/usr/bin/myapp',
        stopOnEntry: false,
        sessionPath: '/my/session.tarodb',
        setupMode: 'new',
        programArgs: '--verbose --port=8080',
        sourcePath: '/workspace/project'
      });

      wireFullStartSession({
        status: 'success',
        sessionPath: '/my/session.tarodb',
        config: { configuration: { program: '/usr/bin/myapp', args: ['--verbose', '--port=8080'], cwd: '/workspace/project' } }
      });

      const sessionPromise = service.startSession();
      await vi.runAllTimersAsync();
      await sessionPromise;

      const calls = mockTransport.sendRequest.mock.calls;
      const firstCall = calls[0][0];
      expect(firstCall).toMatchObject({
        channel: 'setup',
        command: 'new-session',
        arguments: {
          sessionPath: '/my/session.tarodb',
          config: {
            program: '/usr/bin/myapp',
            args: ['--verbose', '--port=8080'],
            cwd: '/workspace/project'
          }
        }
      });
    });

    it('should send open-session on the setup channel when setupMode is open', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '',
        stopOnEntry: false,
        sessionPath: '/my/session.tarodb',
        setupMode: 'open'
      });

      wireFullStartSession({
        status: 'success',
        sessionPath: '/my/session.tarodb',
        config: { configuration: { program: '/usr/bin/myapp', args: [], cwd: '/root' } }
      });

      const sessionPromise = service.startSession();
      await vi.runAllTimersAsync();
      await sessionPromise;

      const calls = mockTransport.sendRequest.mock.calls;
      const firstCall = calls[0][0];
      expect(firstCall).toMatchObject({
        channel: 'setup',
        command: 'open-session',
        arguments: {
          sessionPath: '/my/session.tarodb'
        }
      });
    });

    it('should handle session-failed and transition to error state, keeping transport open', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/usr/bin/myapp',
        stopOnEntry: false,
        sessionPath: '/my/session.tarodb',
        setupMode: 'new'
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          if (req.channel === 'setup') {
            (service as any).handleIncomingMessage({
              channel: 'setup',
              event: 'session-failed',
              body: { error: 'Invalid executable path' }
            });
            return;
          }
        }, 0);
      });

      const sessionPromise = service.startSession();
      sessionPromise.catch(() => {}); // Prevent unhandled rejection
      await vi.runAllTimersAsync();

      await expect(sessionPromise).rejects.toThrow('Invalid executable path');
      expect(service.executionState).toBe('error');
      expect(mockTransport.disconnect).not.toHaveBeenCalled();
    });

    it('should handle transport error during setup handshake and transition to error state', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/usr/bin/myapp',
        stopOnEntry: false,
        sessionPath: '/my/session.tarodb',
        setupMode: 'new'
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          if (req.channel === 'setup') {
            // Simulate sudden transport error/close during starting state
            (service as any).handleIncomingTransportError(new Error('Connection unexpectedly lost'));
            return;
          }
        }, 0);
      });

      const sessionPromise = service.startSession();
      sessionPromise.catch(() => {}); // Prevent unhandled rejection
      await vi.runAllTimersAsync();

      await expect(sessionPromise).rejects.toThrow('Session setup failed: Connection unexpectedly lost');
      expect(mockTransport.disconnect).toHaveBeenCalled();
      expect(service.executionState).toBe('error');
    });

    it('should close transport and transition to disconnected when stop is called in error state', async () => {
      (service as any).executionStateSubject.next('error');
      
      await service.stop();
      
      expect(mockTransport.disconnect).toHaveBeenCalled();
      expect(service.executionState).toBe('disconnected');
    });
  });

  describe('Stop on Entry (WI-123)', () => {
    it('should send setFunctionBreakpoints(main) during session start if stopOnEntry is true', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: true,
        sessionPath: '.tarodb'
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          // Handle setup handshake first
          if (req.channel === 'setup') {
            (service as any).handleIncomingMessage({
              channel: 'setup',
              event: 'session-ready',
              body: { status: 'success', sessionPath: '.tarodb', config: { configuration: { program: '/path/to/exe', args: [], cwd: '/root' } } }
            });
            return;
          }
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: req.command === 'initialize' ? { supportsFunctionBreakpoints: true, supportsTerminateRequest: true } : {}
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
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: false,
        sessionPath: '.tarodb'
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          if (req.channel === 'setup') {
            (service as any).handleIncomingMessage({
              channel: 'setup',
              event: 'session-ready',
              body: { status: 'success', sessionPath: '.tarodb', config: { configuration: { program: '/path/to/exe', args: [], cwd: '/root' } } }
            });
            return;
          }
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: req.command === 'initialize' ? { supportsTerminateRequest: true } : {}
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
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: true,
        sessionPath: '.tarodb'
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          if (req.channel === 'setup') {
            (service as any).handleIncomingMessage({
              channel: 'setup',
              event: 'session-ready',
              body: { status: 'success', sessionPath: '.tarodb', config: { configuration: { program: '/path/to/exe', args: [], cwd: '/root' } } }
            });
            return;
          }
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: req.command === 'initialize' ? { supportsTerminateRequest: true } : {}
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

      const stoppedThread = (service as any).threadObjects.get(1);
      expect(stoppedThread.stopReason).toBe('Paused at entry (main)');
    });

    it('should ignore "breakpoint" events for system-managed breakpoints', async () => {
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

  describe('Mandatory supportsTerminateRequest Enforcing', () => {
    it('should throw DapFatalException during startSession if supportsTerminateRequest is not supported', async () => {
      configService.getConfig.mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080/session/client',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/path/to/exe',
        stopOnEntry: true,
        sessionPath: '.tarodb'
      });

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          if (req.channel === 'setup') {
            (service as any).handleIncomingMessage({
              channel: 'setup',
              event: 'session-ready',
              body: { status: 'success', sessionPath: '.tarodb', config: { configuration: { program: '/path/to/exe', args: [], cwd: '/root' } } }
            });
            return;
          }
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command,
            body: req.command === 'initialize' ? { supportsTerminateRequest: false } : {}
          });
        }, 0);
      });

      const sessionPromise = service.startSession();
      const expectPromise = expect(sessionPromise).rejects.toThrow('Debug adapter does not support terminate request');

      // Simulate initialized event
      setTimeout(() => {
        (service as any).handleIncomingMessage({ type: 'event', event: 'initialized', seq: 100 });
      }, 10);

      await vi.runAllTimersAsync();
      await expectPromise;
    });
  });

  describe('Execution States', () => {
    it('should start with disconnected state', () => {
      expect((service as any).executionStateSubject.value).toBe('disconnected');
    });

    it('should transition through states based on events', () => {
      // Provide a transport so fetchThreads() (triggered by the 'stopped' event) can run cleanly.
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response', request_seq: req.seq, success: true, command: req.command, body: { threads: [] }
          });
        }, 0);
      });

      (service as any).handleTransportEvent({ type: 'event', event: 'stopped', seq: 1 });
      expect((service as any).executionStateSubject.value).toBe('stopped');
      // Flush the pending fetchThreads response before proceeding, so reset() does not reject it.
      vi.advanceTimersByTime(1);

      (service as any).handleTransportEvent({ type: 'event', event: 'continued', seq: 2 });
      expect((service as any).executionStateSubject.value).toBe('running');

      (service as any).handleTransportEvent({ type: 'event', event: 'exited', seq: 3 });
      expect((service as any).executionStateSubject.value).toBe('idle');

      (service as any).handleTransportEvent({ type: 'event', event: 'terminated', seq: 4 });
      expect((service as any).executionStateSubject.value).toBe('disconnected');
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
  });

  describe('Multi-Thread State Tracking', () => {
    beforeEach(() => {
      // Provide a transport so fetchThreads() (triggered by 'stopped' events) resolves cleanly.
      (service as any).transport = mockTransport;
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response', request_seq: req.seq, success: true, command: req.command, body: { threads: [] }
          });
        }, 0);
      });
    });

    it('should track stopped threads in a Set', () => {
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint' }
      });
      const t1 = (service as any).threadObjects.get(1);
      expect(t1).toBeDefined();
      expect(t1.status).toBe('stopped');
      expect(t1.stopReason).toBe('breakpoint');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 2, reason: 'step', allThreadsStopped: true }
      });
      const t2 = (service as any).threadObjects.get(2);
      expect(t2).toBeDefined();
      expect(t2.status).toBe('stopped');
      expect(t2.stopReason).toBe('step');
      expect(t1.status).toBe('stopped');
    });

    it('should remove thread IDs on per-thread continued event', () => {
      // Setup: two threads stopped
      const t1 = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      const t2 = (service as any).getOrCreateThreadObject({ id: 2, name: 'Thread 2' });
      t1.setStatus('stopped');
      t2.setStatus('stopped');
      (service as any).executionStateSubject.next('stopped');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: false }
      });

      expect(t1.status).toBe('running');
      expect(t2.status).toBe('stopped');
      expect((service as any).executionStateSubject.value).toBe('stopped');
    });

    it('should clear all threads on allThreadsContinued event', () => {
      const t1 = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      const t2 = (service as any).getOrCreateThreadObject({ id: 2, name: 'Thread 2' });
      t1.setStatus('stopped');
      t2.setStatus('stopped');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { allThreadsContinued: true }
      });

      expect(t1.status).toBe('running');
      expect(t2.status).toBe('running');
      expect((service as any).executionStateSubject.value).toBe('running');
    });

    it('should transition to running if last stopped thread is continued', () => {
      const t1 = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      t1.setStatus('stopped');
      (service as any).executionStateSubject.next('stopped');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: false }
      });

      expect(t1.status).toBe('running');
      expect((service as any).executionStateSubject.value).toBe('running');
    });

    it('should store and clear per-thread stop reasons', () => {
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint', description: 'Paused on breakpoint' }
      });

      const t1 = (service as any).threadObjects.get(1);
      expect(t1.stopReason).toBe('Paused on breakpoint');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: false }
      });

      expect(t1.stopReason).toBeNull();
    });

    it('should clear all stop reasons on allThreadsContinued', () => {
      const t1 = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      const t2 = (service as any).getOrCreateThreadObject({ id: 2, name: 'Thread 2' });
      t1.setStopReason('reason1');
      t2.setStopReason('reason2');

      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { allThreadsContinued: true }
      });

      expect(t1.stopReason).toBeNull();
      expect(t2.stopReason).toBeNull();
    });

    it('should transition to running when the last stopped thread exits (D2 regression)', () => {
      // Setup: one stopped thread
      const t1 = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      t1.setStatus('stopped');
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
      // t1 marked exited and removed from cache
      expect(t1.status).toBe('exited');
      expect((service as any).threadObjects.get(1)).toBeUndefined();
      // Execution state must NOT remain stuck in 'stopped'
      expect((service as any).executionStateSubject.value).toBe('running');
    });

    it('should dynamically evaluate thread status like running/stopped/exited', () => {
      const t1 = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
      const t2 = (service as any).getOrCreateThreadObject({ id: 2, name: 'Thread 2' });

      // Initially, let both be active in threadsList
      (service as any).threadsSubject.next([t1, t2]);

      // 1. Idle/Running execution state -> both should report 'running'
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'continued',
        body: { allThreadsContinued: true }
      });
      expect(t1.status).toBe('running');
      expect(t2.status).toBe('running');

      // 2. State stops t1 (non-stop mode stopped event)
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint' }
      });
      expect(t1.status).toBe('stopped');
      expect(t2.status).toBe('running');

      // 3. allThreadsStopped is true -> both should report 'stopped'
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'stopped',
        body: { threadId: 2, reason: 'step', allThreadsStopped: true }
      });
      expect(t1.status).toBe('stopped');
      expect(t2.status).toBe('stopped');

      // 4. Thread t2 exits -> it is removed from active threadsList
      (service as any).handleTransportEvent({
        type: 'event',
        event: 'thread',
        body: { threadId: 2, reason: 'exited' }
      });
      // Flush buffered thread events
      vi.advanceTimersByTime(50);

      expect(t1.status).toBe('stopped');
      expect(t2.status).toBe('exited');
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
      const threadObj = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

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
      const threadObj = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

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
      const threadObj = (service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

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
      (service as any).executionStateSubject.next('stopped');
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
      (service as any).executionStateSubject.next('stopped');

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
      (service as any).executionStateSubject.next('stopped');
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

      (service as any).executionStateSubject.next('stopped');
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
      expect((service as any).commandInFlightSubject.value).toBe(false);
    });


  });

  describe('Active Thread Auto-Selection', () => {
    beforeEach(() => {
      // Provide a transport so fetchThreads() (triggered by 'stopped' events) resolves cleanly.
      (service as any).transport = mockTransport;
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response', request_seq: req.seq, success: true, command: req.command, body: { threads: [] }
          });
        }, 0);
      });
    });

    it('should auto-select first stopped thread when stopped event omits threadId and no thread is active', () => {
      // Arrange: no active thread set
      (service as any).activeThreadSubject.next(null);

      // Simulate allThreadsStopped with multiple stopped threads but no explicit threadId
      const t5 = (service as any).getOrCreateThreadObject({ id: 5, name: 'Thread 5' });
      const t7 = (service as any).getOrCreateThreadObject({ id: 7, name: 'Thread 7' });
      const t9 = (service as any).getOrCreateThreadObject({ id: 9, name: 'Thread 9' });
      t5.setStatus('stopped');
      t7.setStatus('stopped');
      t9.setStatus('stopped');

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
      (service as any).activeThreadSubject.next((service as any).getOrCreateThreadObject({ id: 7, name: 'Thread 7' }));
      const t5 = (service as any).getOrCreateThreadObject({ id: 5, name: 'Thread 5' });
      const t7 = (service as any).getOrCreateThreadObject({ id: 7, name: 'Thread 7' });
      const t9 = (service as any).getOrCreateThreadObject({ id: 9, name: 'Thread 9' });
      t5.setStatus('stopped');
      t7.setStatus('stopped');
      t9.setStatus('stopped');

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
      (service as any).activeThreadSubject.next((service as any).getOrCreateThreadObject({ id: 1, name: 'Thread 1' }));

      // Act: stopped event with explicit threadId=12
      (service as any).handleTransportEvent({
        type: 'event', event: 'stopped', seq: 1,
        body: { threadId: 12, allThreadsStopped: false }
      });

      // Assert: active thread updated to the one reported by the adapter
      expect((service as any).activeThreadSubject.value?.id).toBe(12);
    });
  });

  describe('Threads Query Coalescing', () => {
    it('UT-4: should coalesce concurrent parallel threads queries into a single in-flight DAP request', async () => {
      (service as any).transport = mockTransport;

      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: 'threads',
            body: { threads: [{ id: 1, name: 'Thread 1' }] }
          });
        }, 10);
      });

      const p1 = service.fetchThreads();
      const p2 = service.fetchThreads();

      vi.advanceTimersByTime(10);

      await Promise.all([p1, p2]);

      expect(mockTransport.sendRequest).toHaveBeenCalledTimes(1);
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
        command: 'threads'
      }));
    });
  });

  // ── Stop and Restart Logic (R-CS5 / WI-86) ────────────────────────

  describe('Stop and Restart Logic (R-CS5)', () => {
    /** Helper: simulate adapter responding with terminate ack and emitting 'exited' + 'terminated' events (per DAP spec order) */
    function simulateTerminateFlow(): void {
      mockTransport.sendRequest.mockImplementation((req: any) => {
        setTimeout(() => {
          (service as any).handleIncomingMessage({
            type: 'response',
            request_seq: req.seq,
            success: true,
            command: req.command
          });
          if (req.command === 'terminate') {
            // DAP spec: adapter emits 'exited' (transitioning state to idle) before 'terminated'
            (service as any).handleIncomingMessage({
              type: 'event',
              event: 'exited',
              seq: 998,
              body: { exitCode: 0 }
            });
            (service as any).handleIncomingMessage({
              type: 'event',
              event: 'terminated',
              seq: 999
            });
          }
        }, 0);
      });
    }

    describe('stop() — Early-Return States', () => {
      it('should return early without sending a request when state is idle', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('idle');

        // Act
        await service.stop();

        // Assert
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });

      it('should return early without sending a request when state is disconnected', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        // State starts as 'disconnected' by default

        // Act
        await service.stop();

        // Assert
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });

      it('should return early without sending a request when state is error', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('error');

        // Act
        await service.stop();

        // Assert
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });
    });

    describe('stop() — Active States', () => {
      it('should send terminate request and await terminated event when state is running', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('running');
        simulateTerminateFlow();

        // Act
        const stopPromise = service.stop();
        vi.advanceTimersByTime(10);
        await stopPromise;

        // Assert
        expect(mockTransport.sendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'terminate' })
        );
      });

      it('should send terminate request and await terminated event when state is stopped', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('stopped');
        simulateTerminateFlow();

        // Act
        const stopPromise = service.stop();
        vi.advanceTimersByTime(10);
        await stopPromise;

        // Assert
        expect(mockTransport.sendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'terminate' })
        );
      });

      it('should send terminate request when state is starting', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('starting');

        // Provide a minimal mock: respond to terminate, then emit the terminated event
        // directly via the internal eventSubject (bypassing handleTransportEvent which would
        // call disconnect() from 'starting', throwing DapFatalException).
        mockTransport.sendRequest.mockImplementation((req: any) => {
          setTimeout(() => {
            (service as any).handleIncomingMessage({
              type: 'response',
              request_seq: req.seq,
              success: true,
              command: req.command
            });
            if (req.command === 'terminate') {
              // Emit directly to the event subject to unblock the firstValueFrom in stop(),
              // without invoking handleTransportEvent which would try to call disconnect().
              (service as any).eventSubject.next({ type: 'event', event: 'terminated', seq: 999 });
            }
          }, 0);
        });

        // Act
        const stopPromise = service.stop();
        vi.advanceTimersByTime(10);
        await stopPromise;

        // Assert
        expect(mockTransport.sendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'terminate' })
        );
      });


      it('should NOT synchronously modify execution state when terminate is sent', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('running');

        // Do NOT immediately emit terminated event — state transition must NOT happen synchronously
        mockTransport.sendRequest.mockReturnValue(new Promise(() => { }));

        // Act
        service.stop(); // fire-and-forget (intentionally not awaited)

        // Assert: state must not have changed synchronously
        expect((service as any).executionStateSubject.value).toBe('running');
      });
    });

    describe('Disconnect Pre-condition Guard', () => {
      it('should return early without throwing when called from disconnected state', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        // Default initial state is 'disconnected'

        // Act & Assert
        await expect((service as any).disconnect()).resolves.toBeUndefined();
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });

      it('should throw DapFatalException when called from running state', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('running');

        // Act & Assert
        await expect((service as any).disconnect()).rejects.toThrow(DapFatalException);
      });

      it('should transition to disconnected and send disconnect request when called from stopped state', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('stopped');

        mockTransport.sendRequest.mockImplementation((req: any) => {
          setTimeout(() => {
            (service as any).handleIncomingMessage({
              type: 'response',
              request_seq: req.seq,
              success: true,
              command: req.command
            });
          }, 0);
        });

        // Act
        const p = (service as any).disconnect();
        vi.advanceTimersByTime(10);
        await p;

        // Assert
        expect((service as any).executionStateSubject.value).toBe('disconnected');
        expect(mockTransport.sendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'disconnect' })
        );
      });

      it('should throw DapFatalException when called from starting state', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('starting');

        // Act & Assert
        await expect((service as any).disconnect()).rejects.toThrow(DapFatalException);
      });

      it('should return early without throwing when called from error state', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('error');

        // Act & Assert: user changed disconnect() to return early for 'error' (not throw)
        await expect((service as any).disconnect()).resolves.toBeUndefined();
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });

      it('should transition to disconnected and send disconnect request when called from idle', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('idle');

        mockTransport.sendRequest.mockImplementation((req: any) => {
          setTimeout(() => {
            (service as any).handleIncomingMessage({
              type: 'response',
              request_seq: req.seq,
              success: true,
              command: req.command
            });
          }, 0);
        });

        // Act
        const p = (service as any).disconnect();
        vi.advanceTimersByTime(10);
        await p;

        // Assert
        expect((service as any).executionStateSubject.value).toBe('disconnected');
        expect(mockTransport.sendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'disconnect' })
        );
      });
    });

    describe('Continue Pre-condition Guard', () => {
      it('should throw DapFatalException when called from disconnected state', async () => {
        (service as any).executionStateSubject.next('disconnected');
        await expect(service.continue()).rejects.toThrow(DapFatalException);
      });

      it('should throw DapFatalException when called from running state', async () => {
        (service as any).executionStateSubject.next('running');
        await expect(service.continue()).rejects.toThrow(DapFatalException);
      });

      it('should throw DapFatalException when called from idle state', async () => {
        (service as any).executionStateSubject.next('idle');
        await expect(service.continue()).rejects.toThrow(DapFatalException);
      });

      it('should throw DapFatalException when called from starting state', async () => {
        (service as any).executionStateSubject.next('starting');
        await expect(service.continue()).rejects.toThrow(DapFatalException);
      });

      it('should throw DapFatalException when called from error state', async () => {
        (service as any).executionStateSubject.next('error');
        await expect(service.continue()).rejects.toThrow(DapFatalException);
      });

      it('should succeed and send continue request when called from stopped state', async () => {
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('stopped');

        mockTransport.sendRequest.mockImplementation((req: any) => {
          setTimeout(() => {
            (service as any).handleIncomingMessage({
              type: 'response',
              request_seq: req.seq,
              success: true,
              command: req.command
            });
          }, 0);
        });

        const p = service.continue();
        vi.advanceTimersByTime(10);
        await p;

        expect(mockTransport.sendRequest).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'continue' })
        );
      });
    });

    describe('restart() — Soft Restart', () => {
      it('should return early without doing anything when state is idle', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('idle');

        // Act
        await service.restart();

        // Assert
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });

      it('should return early without doing anything when state is starting', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('starting');

        // Act
        await service.restart();

        // Assert
        expect(mockTransport.sendRequest).not.toHaveBeenCalled();
      });

      it('should call stop() before initializeSession() when state is running (Soft Restart)', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('running');

        const callOrder: string[] = [];
        const stopSpy = vi.spyOn(service, 'stop').mockImplementation(async () => {
          callOrder.push('stop');
        });
        const initializeSpy = vi.spyOn(service as any, 'initializeSession').mockImplementation(async () => {
          callOrder.push('initializeSession');
          return {} as any;
        });

        // Act
        await service.restart();

        // Assert
        expect(stopSpy).toHaveBeenCalledTimes(1);
        expect(initializeSpy).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual(['stop', 'initializeSession']);
      });

      it('should call stop() before initializeSession() when state is stopped (Soft Restart)', async () => {
        // Arrange
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('stopped');

        const callOrder: string[] = [];
        const stopSpy = vi.spyOn(service, 'stop').mockImplementation(async () => {
          callOrder.push('stop');
        });
        const initializeSpy = vi.spyOn(service as any, 'initializeSession').mockImplementation(async () => {
          callOrder.push('initializeSession');
          return {} as any;
        });

        // Act
        await service.restart();

        // Assert
        expect(callOrder).toEqual(['stop', 'initializeSession']);
      });
    });
  });
  // ── WI-140: State Guard Enforcement ────────────────────────────────

  describe('WI-140: Step Command State Guards', () => {
    const stepMethods = ['continue', 'next', 'stepIn', 'stepOut', 'nextInstruction', 'stepInInstruction'] as const;
    const nonStoppedStates: ExecutionState[] = ['disconnected', 'idle', 'starting', 'running', 'error'];

    for (const method of stepMethods) {
      for (const state of nonStoppedStates) {
        it(`should throw DapFatalException when calling ${method}() from '${state}' state`, async () => {
          (service as any).transport = mockTransport;
          (service as any).executionStateSubject.next(state);

          await expect((service as any)[method]()).rejects.toThrow(DapFatalException);
        });
      }
    }

    for (const method of stepMethods) {
      it(`should NOT throw when calling ${method}() from 'stopped' state`, async () => {
        (service as any).transport = mockTransport;
        (service as any).executionStateSubject.next('stopped');

        // Resolve immediately so the promise doesn't hang
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

        const promise = (service as any)[method]();
        vi.advanceTimersByTime(1);
        await expect(promise).resolves.toBeDefined();
      });
    }
  });

});
