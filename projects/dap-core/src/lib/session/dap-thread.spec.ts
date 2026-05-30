import { describe, it, expect, vi } from 'vitest';
import { DapThreadSession } from './dap-thread';
import { DapRequestSender } from './dap-request-sender.interface';
import { DapResponse } from '../dap.types';

function makeMockRequestSender(overrides: Partial<DapRequestSender> = {}): DapRequestSender {
  return {
    executionState: 'running',
    sendRequest: vi.fn().mockResolvedValue({ success: true, body: { stackFrames: [] } } as DapResponse),
    ...overrides,
  };
}

describe('DapThreadSession', () => {

  describe('initialization-test', () => {
    it('should initialize thread details and status based on session state', () => {
      // Arrange
      const mockSenderStopped = makeMockRequestSender({ executionState: 'stopped' });
      const mockSenderRunning = makeMockRequestSender({ executionState: 'running' });
      const rawThread = { id: 42, name: 'Main Thread' };

      // Act
      const threadStopped = new DapThreadSession(mockSenderStopped, rawThread);
      const threadRunning = new DapThreadSession(mockSenderRunning, rawThread);

      // Assert
      expect(threadStopped.id).toBe(42);
      expect(threadStopped.name).toBe('Main Thread');
      expect(threadStopped.status).toBe('stopped');

      expect(threadRunning.id).toBe(42);
      expect(threadRunning.name).toBe('Main Thread');
      expect(threadRunning.status).toBe('running');
    });
  });

  describe('status-test', () => {
    it('should set status and stop reason correctly', () => {
      // Arrange
      const mockSender = makeMockRequestSender();
      const thread = new DapThreadSession(mockSender, { id: 1, name: 'thread-1' });

      // Act & Assert 1: updating status to stopped
      thread.setStatus('stopped');
      expect(thread.status).toBe('stopped');

      // Act & Assert 2: updating stop reason
      thread.setStopReason('breakpoint');
      expect(thread.stopReason).toBe('breakpoint');

      // Act & Assert 3: setting status back to running clears stop reason
      thread.setStatus('running');
      expect(thread.status).toBe('running');
      expect(thread.stopReason).toBeNull();

      // Act & Assert 4: setting status to exited clears stop reason
      thread.setStopReason('signal');
      thread.setStatus('exited');
      expect(thread.status).toBe('exited');
      expect(thread.stopReason).toBeNull();
    });
  });

  describe('stacktrace-caching-test', () => {
    it('should fetch stack trace and cache the result', async () => {
      // Arrange
      const mockResponse: DapResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'stackTrace',
        body: {
          stackFrames: [
            { id: 100, name: 'frame1', line: 10, column: 1, source: { name: 'main.cpp', path: '/src/main.cpp' } }
          ]
        }
      };
      const mockSender = makeMockRequestSender({
        sendRequest: vi.fn().mockResolvedValue(mockResponse)
      });
      const thread = new DapThreadSession(mockSender, { id: 42, name: 'thread-42' });

      // Act
      const frames1 = await thread.stackTrace();

      // Assert
      expect(mockSender.sendRequest).toHaveBeenCalledWith('stackTrace', { threadId: 42 });
      expect(frames1).toEqual(mockResponse.body?.stackFrames);
      expect(thread.cachedFrames).toEqual(mockResponse.body?.stackFrames);

      // Act (second call)
      const frames2 = await thread.stackTrace();

      // Assert (second call - verify cached result)
      expect(frames2).toEqual(mockResponse.body?.stackFrames);
      expect(mockSender.sendRequest).toHaveBeenCalledTimes(1);
    });

    it('should coalesce concurrent stack trace queries into a single request', async () => {
      // Arrange
      let resolvePromise!: (value: DapResponse) => void;
      const pendingPromise = new Promise<DapResponse>((resolve) => {
        resolvePromise = resolve;
      });
      const mockSender = makeMockRequestSender({
        sendRequest: vi.fn().mockReturnValue(pendingPromise)
      });
      const thread = new DapThreadSession(mockSender, { id: 42, name: 'thread-42' });

      // Act
      const promise1 = thread.stackTrace();
      const promise2 = thread.stackTrace();

      // Assert pre-resolution loading state
      expect(thread.isLoadingStackTrace).toBe(true);
      expect(mockSender.sendRequest).toHaveBeenCalledTimes(1);

      // Act (resolve promise)
      const mockResponse: DapResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'stackTrace',
        body: {
          stackFrames: [{ id: 200, name: 'frame2', line: 20, column: 2 }]
        }
      };
      resolvePromise(mockResponse);
      const frames1 = await promise1;
      const frames2 = await promise2;

      // Assert post-resolution states
      expect(frames1).toEqual(mockResponse.body?.stackFrames);
      expect(frames2).toEqual(mockResponse.body?.stackFrames);
      expect(thread.isLoadingStackTrace).toBe(false);
      expect(mockSender.sendRequest).toHaveBeenCalledTimes(1);
    });

    it('should clear loading promise and throw if sendRequest fails', async () => {
      // Arrange
      const mockSender = makeMockRequestSender({
        sendRequest: vi.fn().mockRejectedValue(new Error('DAP Network Error'))
      });
      const thread = new DapThreadSession(mockSender, { id: 42, name: 'thread-42' });

      // Act & Assert 1: verify failure propagation
      await expect(thread.stackTrace()).rejects.toThrow('DAP Network Error');
      expect(thread.isLoadingStackTrace).toBe(false);

      // Act & Assert 2: verify subsequent call triggers new network request
      mockSender.sendRequest = vi.fn().mockResolvedValue({
        success: true,
        body: { stackFrames: [{ id: 300, name: 'frame3', line: 30, column: 3 }] }
      } as DapResponse);
      const frames = await thread.stackTrace();
      expect(frames).toHaveLength(1);
      expect(frames[0].id).toBe(300);
      expect(mockSender.sendRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache-clearing-test', () => {
    it('should clear cache when clearCache is called', async () => {
      // Arrange
      const mockResponse: DapResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        success: true,
        command: 'stackTrace',
        body: {
          stackFrames: [{ id: 100, name: 'frame1', line: 10, column: 1 }]
        }
      };
      const mockSender = makeMockRequestSender({
        sendRequest: vi.fn().mockResolvedValue(mockResponse)
      });
      const thread = new DapThreadSession(mockSender, { id: 42, name: 'thread-42' });

      // Act
      await thread.stackTrace();
      thread.clearCache();

      // Assert
      expect(thread.cachedFrames).toBeUndefined();

      // Act (call again after clearing)
      await thread.stackTrace();

      // Assert (called again)
      expect(mockSender.sendRequest).toHaveBeenCalledTimes(2);
    });
  });

});
