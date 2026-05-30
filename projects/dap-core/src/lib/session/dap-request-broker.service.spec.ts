import { TestBed } from '@angular/core/testing';
import { DapRequestBroker } from './dap-request-broker.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { DapEvent, DapResponse } from '../dap.types';

describe('DapRequestBroker', () => {
  let broker: DapRequestBroker;
  let mockTransport: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockTransport = {
      sendRequest: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        DapRequestBroker
      ]
    });

    broker = TestBed.inject(DapRequestBroker);
    broker.setTransport(mockTransport);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('setTransport()', () => {
    it('should set the transport correctly', () => {
      // Arrange & Act
      const newMockTransport = { sendRequest: vi.fn() };
      broker.setTransport(newMockTransport as any);

      // Assert
      expect((broker as any).transport).toBe(newMockTransport);
    });
  });

  describe('Sequence ID Management', () => {
    it('should increment seq for each request sequentially', async () => {
      // Act
      broker.sendRequest('command1');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 1 }));

      broker.sendRequest('command2');
      expect(mockTransport.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 2 }));

      // Assert
      expect(broker.currentSeq).toBe(3);
    });

    it('should fail request if transport is not initialized', async () => {
      // Arrange
      broker.setTransport(undefined!);

      // Act & Assert
      await expect(broker.sendRequest('command')).rejects.toThrow('Transport not initialized');
    });
  });

  describe('Promise Mapping & handleResponse()', () => {
    it('should resolve the promise when a successful matching response is received', async () => {
      // Arrange
      const promise = broker.sendRequest('testCommand');

      // Act
      broker.handleResponse({
        seq: 10,
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'testCommand',
        body: { result: 'ok' }
      });

      const response = await promise;

      // Assert
      expect(response.body.result).toBe('ok');
      expect(broker.pendingRequestsCount).toBe(0);
    });

    it('should reject the promise and emit _dapError when a failed response is received', async () => {
      // Arrange
      const promise = broker.sendRequest('testCommand');
      const emittedEvents: DapEvent[] = [];
      const sub = broker.onEvent().subscribe(e => emittedEvents.push(e));

      // Act
      broker.handleResponse({
        seq: 10,
        type: 'response',
        request_seq: 1,
        success: false,
        command: 'testCommand',
        message: 'Something went wrong'
      });

      // Assert
      await expect(promise).rejects.toThrow('Something went wrong');
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('_dapError');
      expect(emittedEvents[0].body.command).toBe('testCommand');
      expect(emittedEvents[0].body.message).toBe('Something went wrong');

      sub.unsubscribe();
    });

    it('should reject silently without emitting _dapError if silentError is true', async () => {
      // Arrange
      const promise = broker.sendRequest('testCommand', {}, 5000, true);
      const emittedEvents: DapEvent[] = [];
      const sub = broker.onEvent().subscribe(e => emittedEvents.push(e));

      // Act
      broker.handleResponse({
        seq: 10,
        type: 'response',
        request_seq: 1,
        success: false,
        command: 'testCommand',
        message: 'Something went wrong'
      });

      // Assert
      await expect(promise).rejects.toThrow('Something went wrong');
      expect(emittedEvents).toHaveLength(0);

      sub.unsubscribe();
    });

    it('should emit _sessionWarning when receiving response for unknown request_seq', () => {
      // Arrange
      const emittedEvents: DapEvent[] = [];
      const sub = broker.onEvent().subscribe(e => emittedEvents.push(e));

      // Act
      broker.handleResponse({
        seq: 10,
        type: 'response',
        request_seq: 999,
        success: true,
        command: 'unknown'
      });

      // Assert
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('_sessionWarning');
      expect(emittedEvents[0].body.message).toContain('unknown request_seq=999');

      sub.unsubscribe();
    });
  });

  describe('Timeout Mechanism', () => {
    it('should reject and emit _sessionWarning when request times out', async () => {
      // Arrange
      const promise = broker.sendRequest('slowCommand', {}, 100);
      const emittedEvents: DapEvent[] = [];
      const sub = broker.onEvent().subscribe(e => emittedEvents.push(e));

      // Act
      vi.advanceTimersByTime(101);

      // Assert
      await expect(promise).rejects.toThrow(/timed out/);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('_sessionWarning');
      expect(emittedEvents[0].body.message).toContain('slowCommand');

      sub.unsubscribe();
    });
  });

  describe('clearPendingRequests()', () => {
    it('should reject all active pending requests with the provided error', async () => {
      // Arrange
      const promise1 = broker.sendRequest('cmd1');
      const promise2 = broker.sendRequest('cmd2');
      const testError = new Error('Test session abort');

      expect(broker.pendingRequestsCount).toBe(2);

      // Act
      broker.clearPendingRequests(testError);

      // Assert
      await expect(promise1).rejects.toThrow('Test session abort');
      await expect(promise2).rejects.toThrow('Test session abort');
      expect(broker.pendingRequestsCount).toBe(0);
    });
  });

  describe('Diagnostic Streams', () => {
    it('should emit outbound requests to onTraffic$', async () => {
      // Arrange
      const emittedTraffic: any[] = [];
      const sub = broker.onTraffic().subscribe(t => emittedTraffic.push(t));

      // Act
      broker.sendRequest('trafficCommand', { key: 'value' });

      // Assert
      expect(emittedTraffic).toHaveLength(1);
      expect(emittedTraffic[0]).toMatchObject({
        seq: 1,
        type: 'request',
        command: 'trafficCommand',
        arguments: { key: 'value' }
      });

      sub.unsubscribe();
    });
  });
});
