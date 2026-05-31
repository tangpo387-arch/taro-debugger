import { Injectable, Injector, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DapThread, DapEvent } from '../dap.types';
import { DapThreadSession } from './dap-thread';
import { DapSessionService } from './dap-session.service';

@Injectable()
export class DapThreadManager {
  private readonly injector = inject(Injector);

  private readonly threadsSubject = new BehaviorSubject<DapThreadSession[]>([]);
  public readonly threads$ = this.threadsSubject.asObservable();

  private readonly threadObjects = new Map<number, DapThreadSession>();
  private threadEventsBuffer: any[] = [];
  private threadEventTimeout: any = null;
  private threadsQueryInFlight: Promise<void> | null = null;

  private readonly activeThreadSubject = new BehaviorSubject<DapThreadSession | null>(null);
  public readonly activeThread$ = this.activeThreadSubject.asObservable();

  /**
   * Returns the current threads list.
   */
  public get threadsList(): DapThreadSession[] {
    return this.threadsSubject.value;
  }

  /**
   * Returns the current active thread.
   */
  public get activeThread(): DapThreadSession | null {
    return this.activeThreadSubject.value;
  }

  /**
   * Updates the active thread.
   */
  public setActiveThread(thread: DapThreadSession | null): void {
    this.activeThreadSubject.next(thread);
  }

  /**
   * Returns the thread objects map.
   */
  public getThreadObjects(): Map<number, DapThreadSession> {
    return this.threadObjects;
  }

  /**
   * Resets thread manager state on session end or error.
   */
  public clearAll(): void {
    if (this.threadEventTimeout) {
      clearTimeout(this.threadEventTimeout);
      this.threadEventTimeout = null;
    }
    this.threadEventsBuffer = [];
    this.threadObjects.forEach(t => t.setStatus('exited'));
    this.threadObjects.clear();
    this.threadsSubject.next([]);
    this.activeThreadSubject.next(null);
  }

  /**
   * Clears stackTrace cache for all ThreadObjects.
   */
  public clearAllThreadCaches(): void {
    this.threadObjects.forEach((thread) => thread.clearCache());
  }

  /**
   * Returns or creates the rich ThreadObject for the raw thread payload.
   */
  public getOrCreateThreadObject(thread: DapThread): DapThreadSession {
    let obj = this.threadObjects.get(thread.id);
    if (!obj) {
      const sessionService = this.injector.get(DapSessionService);
      obj = new DapThreadSession(sessionService, thread);
      this.threadObjects.set(thread.id, obj);
    }
    return obj;
  }

  /**
   * Fetch threads and update the subjects.
   */
  public async fetchThreads(): Promise<void> {
    if (this.threadsQueryInFlight) {
      return this.threadsQueryInFlight;
    }

    this.threadsQueryInFlight = (async () => {
      try {
        const sessionService = this.injector.get(DapSessionService);

        const response = await sessionService.sendRequestInternal('threads');
        if (response.success && response.body?.threads) {
          const mapped = response.body.threads.map((t: any) => this.getOrCreateThreadObject(t));
          this.threadsSubject.next(mapped);
          const currentActive = this.activeThreadSubject.value;
          const threadsList = response.body.threads;
          if (threadsList.length > 0 && (currentActive === null || !threadsList.some((t: any) => t.id === currentActive.id))) {
            this.activeThreadSubject.next(mapped[0]);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch threads', err);
        this.threadsSubject.next([]);
      } finally {
        this.threadsQueryInFlight = null;
      }
    })();

    return this.threadsQueryInFlight;
  }

  /**
   * Set the current active thread and trigger a stackTrace refresh.
   */
  public setCurrentThread(thread: DapThreadSession): void {
    if (this.activeThreadSubject.value?.id === thread.id) {
      return;
    }
    this.activeThreadSubject.next(thread);

    const sessionService = this.injector.get(DapSessionService);
    sessionService.emitSyntheticEvent({
      seq: 0,
      type: 'event',
      event: 'stopped',
      body: { threadId: thread.id }
    });
  }

  /**
   * Unified handler for debug resumption state (Continue, Step, etc).
   * Synchronizes execution state, stopped thread tracking, and reason maps.
   */
  public handleResumptionState(allThreads: boolean, threadId?: number): void {
    this.clearAllThreadCaches();
    
    const sessionService = this.injector.get(DapSessionService);

    if (allThreads) {
      sessionService.setExecutionStateInternal('running');
      this.threadObjects.forEach(t => t.setStatus('running'));

      sessionService.clearStateTransitionGuardInternal();
      sessionService.setCommandInFlightInternal(false);
      this.threadsSubject.next([...this.threadsSubject.value]);
      return;
    }

    if (threadId !== undefined) {
      const resT = this.threadObjects.get(threadId);
      if (resT) {
        resT.setStatus('running');
        if (this.activeThread?.id === resT.id) {
          this.activeThreadSubject.next(resT);
        }
      }

      const hasStopped = Array.from(this.threadObjects.values()).some(t => t.status === 'stopped');
      if (!hasStopped) {
        sessionService.setExecutionStateInternal('running');
      }

      sessionService.clearStateTransitionGuardInternal();
      sessionService.setCommandInFlightInternal(false);
      this.threadsSubject.next([...this.threadsSubject.value]);
    }
  }

  /**
   * Handles the 'stopped' event thread status updates and active thread assignment.
   */
  public handleStoppedEvent(event: DapEvent, isSystemStop: boolean, stopReason: string): void {
    const stoppedThreadId = event.body?.threadId;
    const allThreadsStopped = event.body?.allThreadsStopped ?? false;

    let stoppedThreadObj: DapThreadSession | undefined;
    if (stoppedThreadId !== undefined) {
      stoppedThreadObj = this.getOrCreateThreadObject({ id: stoppedThreadId, name: `Thread ${stoppedThreadId}` });
    }

    if (allThreadsStopped) {
      this.threadObjects.forEach(t => {
        t.setStatus('stopped');
      });
      if (stoppedThreadObj) {
        stoppedThreadObj.setStopReason(stopReason);
      }
    } else if (stoppedThreadObj) {
      stoppedThreadObj.setStatus('stopped');
      stoppedThreadObj.setStopReason(stopReason);
    }

    if (stoppedThreadObj) {
      this.activeThreadSubject.next(stoppedThreadObj);
    } else if (this.activeThreadSubject.value === null) {
      const firstStopped = Array.from(this.threadObjects.values()).find(t => t.status === 'stopped');
      if (firstStopped) {
        this.activeThreadSubject.next(firstStopped);
      }
    }

    this.threadsSubject.next([...this.threadsSubject.value]);
    void this.fetchThreads();
  }

  /**
   * Handles incoming DAP 'thread' events by buffering them.
   */
  public handleThreadEvent(eventBody: any): void {
    this.threadEventsBuffer.push(eventBody);

    if (!this.threadEventTimeout) {
      this.threadEventTimeout = setTimeout(() => {
        this.flushThreadEventsBuffer();
      }, 50); // 50ms buffering window
    }
  }

  private flushThreadEventsBuffer(): void {
    this.threadEventTimeout = null;
    const events = [...this.threadEventsBuffer];
    this.threadEventsBuffer = [];
    
    const sessionService = this.injector.get(DapSessionService);

    let currentThreads = [...this.threadsSubject.value];

    for (const body of events) {
      const reason = body.reason;
      const threadId = body.threadId;
      if (threadId === undefined) continue;

      if (reason === 'started') {
        if (!currentThreads.some(t => t.id === threadId)) {
          const threadObj = this.getOrCreateThreadObject({ id: threadId, name: `Thread ${threadId}` });
          currentThreads.push(threadObj);
        }
      } else if (reason === 'exited') {
        const exitedThread = this.threadObjects.get(threadId);
        if (exitedThread) {
          exitedThread.setStatus('exited');
        }
        currentThreads = currentThreads.filter(t => t.id !== threadId);
        this.threadObjects.delete(threadId);
        if (this.activeThreadSubject.value?.id === threadId) {
          const nextActive = currentThreads.find(t => t.status === 'stopped') || currentThreads[0] || null;
          this.activeThreadSubject.next(nextActive);
        }
      }
    }

    this.threadsSubject.next(currentThreads);
    const hasStopped = currentThreads.some(t => t.status === 'stopped');
    if (!hasStopped && sessionService.executionState === 'stopped') {
      sessionService.setExecutionStateInternal('running');
    }
  }
}
