import { TestBed } from '@angular/core/testing';
import { DapThreadManager } from './dap-thread-manager.service';
import { DapSessionService } from './dap-session.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DapThreadSession } from './dap-thread';

describe('DapThreadManager', () => {
  let manager: DapThreadManager;
  let mockSession: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockSession = {
      sendRequestInternal: vi.fn().mockResolvedValue({
        success: true,
        body: {
          threads: [{ id: 1, name: 'Thread 1' }, { id: 2, name: 'Thread 2' }]
        }
      }),
      emitSyntheticEvent: vi.fn(),
      setExecutionStateInternal: vi.fn(),
      clearStateTransitionGuardInternal: vi.fn(),
      setCommandInFlightInternal: vi.fn(),
      executionState: 'stopped'
    };

    TestBed.configureTestingModule({
      providers: [
        DapThreadManager,
        { provide: DapSessionService, useValue: mockSession }
      ]
    });

    manager = TestBed.inject(DapThreadManager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty state', () => {
    // Assert
    expect(manager.threadsList).toHaveLength(0);
    expect(manager.activeThread).toBeNull();
  });

  it('should get or create ThreadSession objects', () => {
    // Act
    const t1 = manager.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
    const t2 = manager.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

    // Assert
    expect(t1).toBeDefined();
    expect(t1.id).toBe(1);
    expect(t2).toBe(t1); // Should return the same cached instance
  });

  it('should fetch threads and select first active', async () => {
    // Act
    const promise = manager.fetchThreads();
    await promise;

    // Assert
    expect(manager.threadsList).toHaveLength(2);
    expect(manager.activeThread).toBeDefined();
    expect(manager.activeThread?.id).toBe(1);
    expect(mockSession.sendRequestInternal).toHaveBeenCalledWith('threads');
  });

  it('should set current active thread and emit SyntheticEvent', () => {
    // Arrange
    const t1 = manager.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });

    // Act
    manager.setCurrentThread(t1);

    // Assert
    expect(manager.activeThread).toBe(t1);
    expect(mockSession.emitSyntheticEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'stopped',
      body: { threadId: 1 }
    }));
  });

  it('should buffer and flush thread events with debounce', () => {
    // Act
    manager.handleThreadEvent({ reason: 'started', threadId: 3 });
    manager.handleThreadEvent({ reason: 'started', threadId: 4 });

    // Assert (no synchronous push before flush)
    expect(manager.threadsList).toHaveLength(0);

    // Act (advance debouncer by 50ms)
    vi.advanceTimersByTime(50);

    // Assert
    expect(manager.threadsList).toHaveLength(2);
    expect(manager.threadsList.some(t => t.id === 3)).toBe(true);
    expect(manager.threadsList.some(t => t.id === 4)).toBe(true);
  });

  it('should handle stopped event and assign stop reasons', () => {
    // Arrange
    const event = {
      seq: 1,
      type: 'event' as const,
      event: 'stopped',
      body: {
        threadId: 2,
        allThreadsStopped: true,
        reason: 'breakpoint'
      }
    };

    // Act
    manager.handleStoppedEvent(event, false, 'Hit breakpoint');

    // Assert
    expect(manager.activeThread?.id).toBe(2);
    expect(manager.activeThread?.stopReason).toBe('Hit breakpoint');
    expect(manager.activeThread?.status).toBe('stopped');
  });

  it('should update active thread subject when active thread status changes to running', () => {
    // Arrange
    const t1 = manager.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
    manager.setActiveThread(t1);
    let activeThreadEmitted: DapThreadSession | null = null;
    manager.activeThread$.subscribe(t => activeThreadEmitted = t);

    // Act
    manager.handleResumptionState(false, 1);

    // Assert
    expect(t1.status).toBe('running');
    expect(activeThreadEmitted).toBe(t1);
  });

  it('should transition active thread when active thread exits', () => {
    // Arrange
    const t1 = manager.getOrCreateThreadObject({ id: 1, name: 'Thread 1' });
    const t2 = manager.getOrCreateThreadObject({ id: 2, name: 'Thread 2' });
    t2.setStatus('stopped');
    manager.handleThreadEvent({ reason: 'started', threadId: 1 });
    manager.handleThreadEvent({ reason: 'started', threadId: 2 });
    vi.advanceTimersByTime(50);
    manager.setActiveThread(t1);

    // Act - thread 1 exits
    manager.handleThreadEvent({ reason: 'exited', threadId: 1 });
    vi.advanceTimersByTime(50);

    // Assert
    expect(manager.activeThread?.id).toBe(2);
  });
});
