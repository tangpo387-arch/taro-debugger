import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { DapSessionLifecycle } from './dap-session-lifecycle.service';
import { DapConfigService } from './dap-config.service';
import { TransportFactoryService } from '../transport/transport-factory.service';
import { DapBreakpointManager } from './dap-breakpoint-manager.service';
import { DapThreadManager } from './dap-thread-manager.service';
import { DapRequestBroker } from './dap-request-broker.service';
import { DapExecutionController } from './dap-execution-controller.service';

describe('DapSessionLifecycle', () => {
  let lifecycle: DapSessionLifecycle;
  let mockConfigService: any;
  let mockTransportFactory: any;
  let mockTransport: any;
  let mockBreakpointManager: any;
  let mockThreadManager: any;
  let mockRequestBroker: any;
  let mockExecutionController: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockConfigService = {
      getConfig: vi.fn().mockReturnValue({
        serverAddress: 'ws://127.0.0.1:8080',
        transportType: 'websocket',
        launchMode: 'launch',
        executablePath: '/bin/app',
        stopOnEntry: false,
        sessionPath: '.tarodb'
      }),
      setConfig: vi.fn()
    };

    mockTransport = {
      connect: vi.fn().mockReturnValue(of(undefined)),
      disconnect: vi.fn(),
      onMessage: vi.fn().mockReturnValue(of()),
      sendRequest: vi.fn(),
      connectionStatus$: new BehaviorSubject<boolean>(false).asObservable()
    };

    mockTransportFactory = {
      createTransport: vi.fn().mockReturnValue(mockTransport)
    };

    mockBreakpointManager = {
      resyncAllBreakpointsInternal: vi.fn().mockResolvedValue(undefined),
      setFunctionBreakpoints: vi.fn().mockResolvedValue(undefined),
      clearAll: vi.fn(),
      handleBreakpointEvent: vi.fn()
    };

    mockThreadManager = {
      fetchThreads: vi.fn().mockResolvedValue(undefined),
      clearAll: vi.fn(),
      handleStoppedEvent: vi.fn(),
      handleResumptionState: vi.fn(),
      handleThreadEvent: vi.fn()
    };

    mockRequestBroker = {
      setTransport: vi.fn(),
      onEvent: vi.fn().mockReturnValue(of()),
      onTraffic: vi.fn().mockReturnValue(of()),
      sendRequest: vi.fn(),
      clearPendingRequests: vi.fn()
    };

    mockExecutionController = {
      setCommandInFlight: vi.fn(),
      clearStateTransitionGuard: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        DapSessionLifecycle,
        { provide: DapConfigService, useValue: mockConfigService },
        { provide: TransportFactoryService, useValue: mockTransportFactory },
        { provide: DapBreakpointManager, useValue: mockBreakpointManager },
        { provide: DapThreadManager, useValue: mockThreadManager },
        { provide: DapRequestBroker, useValue: mockRequestBroker },
        { provide: DapExecutionController, useValue: mockExecutionController }
      ]
    });

    lifecycle = TestBed.inject(DapSessionLifecycle);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('connectTransport()', () => {
    it('should establish connection and subscribe to messages', async () => {
      // Act
      await lifecycle.connectTransport();

      // Assert
      expect(mockTransport.connect).toHaveBeenCalledWith('ws://127.0.0.1:8080');
      expect(mockTransport.onMessage).toHaveBeenCalled();
    });
  });

  describe('initializeSession()', () => {
    it('should execute standard DAP handshake', async () => {
      // Arrange
      mockRequestBroker.sendRequest.mockImplementation((cmd: string) => {
        if (cmd === 'initialize') {
          return Promise.resolve({ success: true, body: { supportsTerminateRequest: true } });
        }
        return Promise.resolve({ success: true });
      });

      // Emit 'initialized' event after short delay
      setTimeout(() => {
        lifecycle.handleIncomingMessage({ type: 'event', event: 'initialized', seq: 1 });
      }, 10);

      // Act
      const initPromise = lifecycle.initializeSession();
      vi.advanceTimersByTime(11);
      const response = await initPromise;

      // Assert
      expect(mockRequestBroker.sendRequest).toHaveBeenCalledWith('initialize', expect.any(Object));
      expect(lifecycle.executionState).toBe('running');
      expect(mockThreadManager.fetchThreads).toHaveBeenCalled();
    });
  });

  describe('reset()', () => {
    it('should clear pending requests and reset sub-managers', () => {
      // Act
      lifecycle.reset();

      // Assert
      expect(mockRequestBroker.clearPendingRequests).toHaveBeenCalled();
      expect(mockExecutionController.setCommandInFlight).toHaveBeenCalledWith(false);
      expect(mockThreadManager.clearAll).toHaveBeenCalled();
      expect(mockBreakpointManager.clearAll).toHaveBeenCalled();
    });
  });
});
