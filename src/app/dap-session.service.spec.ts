import { TestBed } from '@angular/core/testing';
import { DapSessionService, ExecutionState } from './dap-session.service';
import { DapConfigService } from './dap-config.service';
import { DapLogService } from './dap-log.service';
import { TransportFactoryService } from './transport-factory.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Subject, of, BehaviorSubject } from 'rxjs';

describe('DapSessionService', () => {
  let service: DapSessionService;
  let configService: any;
  let logService: any;
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

    logService = {
      consoleLog: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        DapSessionService,
        { provide: TransportFactoryService, useValue: transportFactory },
        { provide: DapConfigService, useValue: configService },
        { provide: DapLogService, useValue: logService }
      ]
    });

    service = TestBed.inject(DapSessionService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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

      (service as any).handleIncomingMessage({
        type: 'response',
        request_seq: 999,
        success: true,
        command: 'unknown'
      });

      expect(logService.consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('unknown request_seq=999'),
        'error',
        'system'
      );
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
});
