import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { DapExecutionController } from './dap-execution-controller.service';
import { DapSessionService, ExecutionState } from './dap-session.service';
import { DapThreadManager } from './dap-thread-manager.service';
import { DapSessionLifecycle } from './dap-session-lifecycle.service';

describe('DapExecutionController', () => {
  let controller: DapExecutionController;
  let mockSessionService: any;
  let mockThreadManager: any;
  let mockSessionLifecycle: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockSessionService = {
      sendRequest: vi.fn()
    };

    mockThreadManager = {
      activeThread: { id: 1, name: 'Thread 1' },
      handleResumptionState: vi.fn().mockImplementation(() => {
        controller.setCommandInFlight(false);
      })
    };

    mockSessionLifecycle = {
      executionState: 'stopped' as ExecutionState,
      emitSyntheticEvent: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        DapExecutionController,
        { provide: DapSessionService, useValue: mockSessionService },
        { provide: DapThreadManager, useValue: mockThreadManager },
        { provide: DapSessionLifecycle, useValue: mockSessionLifecycle }
      ]
    });

    controller = TestBed.inject(DapExecutionController);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('executeStepCommand()', () => {
    it('should send continue request and handle resumption', async () => {
      // Arrange
      mockSessionService.sendRequest.mockResolvedValue({ success: true, body: { allThreadsContinued: true } });

      // Act
      const promise = controller.continue();
      await promise;

      // Assert
      expect(mockSessionService.sendRequest).toHaveBeenCalledWith('continue', { threadId: 1 });
      expect(mockThreadManager.handleResumptionState).toHaveBeenCalledWith(true, 1);
    });

    it('should set commandInFlight to true while request is in flight', async () => {
      // Arrange
      let resolvePromise: any;
      const requestPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSessionService.sendRequest.mockReturnValue(requestPromise);

      // Act
      const promise = controller.next();

      // Assert
      expect(controller.commandInFlight).toBe(true);

      // Cleanup
      resolvePromise({ success: true });
      await promise;
      expect(controller.commandInFlight).toBe(false);
    });

    it('should throw error and clear commandInFlight on request rejection', async () => {
      // Arrange
      mockSessionService.sendRequest.mockRejectedValue(new Error('Stepping failed'));

      // Act & Assert
      await expect(controller.stepIn()).rejects.toThrow('Stepping failed');
      expect(controller.commandInFlight).toBe(false);
    });

    it('should throw DapFatalException when not in allowed states', async () => {
      // Arrange
      mockSessionLifecycle.executionState = 'running';

      // Act & Assert
      await expect(controller.next()).rejects.toThrow(/Cannot perform 'next'/);
    });
  });

  describe('State Transition Guard', () => {
    it('should unlock UI and emit session error on timeout', () => {
      // Arrange
      mockSessionLifecycle.executionState = 'stopped';
      mockSessionService.sendRequest.mockReturnValue(new Promise(() => {})); // Never resolves

      // Act
      controller.next();
      expect(controller.commandInFlight).toBe(true);

      vi.advanceTimersByTime(5000);

      // Assert
      expect(controller.commandInFlight).toBe(false);
      expect(mockSessionLifecycle.emitSyntheticEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '_sessionError',
          body: expect.objectContaining({
            message: expect.stringContaining("adapter did not emit a state transition")
          })
        })
      );
    });
  });
});
