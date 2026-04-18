import { TestBed } from '@angular/core/testing';
import { DapSessionService, ExecutionState } from './dap-session.service';
import { DapConfigService } from './dap-config.service';
import { TransportFactoryService } from './transport-factory.service';
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

      service.sendRequest('command1');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 1 }));

      service.sendRequest('command2');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 2 }));
    });
  });

  describe('Promise Mapping', () => {
    it('should resolve when matching response is received', async () => {
      (service as any).transport = mockTransport;

      const promise = service.sendRequest('testCommand');
      
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

      const promise = service.sendRequest('testCommand');

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

      const promise = service.sendRequest('slowCommand', {}, 100);

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
      expect((service as any).executionStateSubject.value).toBe('terminated');
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
});
