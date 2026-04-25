import { TestBed } from '@angular/core/testing';
import { DapSessionService, DapThread } from '@taro/dap-core';
import { ThreadsComponent } from '@taro/ui-inspection';
import { BehaviorSubject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('WI-70: Threads Integration', () => {
  let component: ThreadsComponent;
  let mockDapSession: any;
  let threadsSubject: BehaviorSubject<DapThread[]>;
  let activeThreadIdSubject: BehaviorSubject<number | null>;
  let stoppedThreadIdSubject: BehaviorSubject<number | null>;
  let stopReasonSubject: BehaviorSubject<string | null>;

  beforeEach(() => {
    threadsSubject = new BehaviorSubject<DapThread[]>([]);
    activeThreadIdSubject = new BehaviorSubject<number | null>(null);
    stoppedThreadIdSubject = new BehaviorSubject<number | null>(null);
    stopReasonSubject = new BehaviorSubject<string | null>(null);

    mockDapSession = {
      threads$: threadsSubject.asObservable(),
      activeThreadId$: activeThreadIdSubject.asObservable(),
      stoppedThreadId$: stoppedThreadIdSubject.asObservable(),
      stopReason$: stopReasonSubject.asObservable(),
      setCurrentThread: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ThreadsComponent,
        { provide: DapSessionService, useValue: mockDapSession }
      ]
    });

    component = TestBed.inject(ThreadsComponent);
  });

  it('should inject DapSessionService', () => {
    expect(component.dapSession).toBeDefined();
  });

  it('should call setCurrentThread on onThreadClick', () => {
    component.onThreadClick(42);
    expect(mockDapSession.setCurrentThread).toHaveBeenCalledWith(42);
  });
});
