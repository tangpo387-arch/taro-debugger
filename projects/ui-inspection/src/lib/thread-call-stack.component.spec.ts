import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreadCallStackComponent, ExecutionNode } from './thread-call-stack.component';
import { DapSessionService, DapThread, DapStackFrame, DapConfigService } from '@taro/dap-core';

function makeMockDapSession(overrides: Partial<DapSessionService> = {}) {
  const threads$ = new BehaviorSubject<DapThread[]>([]);
  const activeThreadId$ = new BehaviorSubject<number | null>(null);
  const stoppedThreads$ = new BehaviorSubject<Set<number>>(new Set());
  const allThreadsStopped$ = new BehaviorSubject<boolean>(false);
  const executionState$ = new BehaviorSubject<string>('idle');
  const processInfo$ = new BehaviorSubject<any>(null);
  const threadStopReasons$ = new BehaviorSubject<Map<number, string>>(new Map());
  const eventSubject = new Subject<any>();

  return {
    threads$,
    activeThreadId$,
    stoppedThreads$,
    allThreadsStopped$,
    executionState$,
    processInfo$,
    threadStopReasons$,
    onEvent: vi.fn().mockReturnValue(eventSubject.asObservable()),
    stackTrace: vi.fn().mockResolvedValue({ success: true, body: { stackFrames: [] } }),
    setCurrentThread: vi.fn(),
    ...overrides,
    _eventSubject: eventSubject
  };
}

function makeMockConfigService(overrides = {}) {
  return {
    getConfig: vi.fn().mockReturnValue({ executablePath: 'test-app' }),
    ...overrides,
  };
}

describe('ThreadCallStackComponent', () => {
  let fixture: ComponentFixture<ThreadCallStackComponent>;
  let component: ThreadCallStackComponent;
  let mockSession: any;
  let mockConfig: any;

  beforeEach(async () => {
    mockSession = makeMockDapSession();
    mockConfig = makeMockConfigService();

    await TestBed.configureTestingModule({
      imports: [ThreadCallStackComponent],
      providers: [
        { provide: DapSessionService, useValue: mockSession },
        { provide: DapConfigService, useValue: mockConfig },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ThreadCallStackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('Explicit Thread Selection', () => {
    it('should NOT call setCurrentThread when a thread row label is clicked', async () => {
      // Arrange
      const threads = [{ id: 1, name: 'Main' }];
      mockSession.threads$.next(threads);
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 20));
      fixture.detectChanges();

      const threadRows = fixture.debugElement.queryAll(By.css('.mat-tree-node'));
      const threadRow = threadRows.find(el => el.nativeElement.textContent.includes('Main'));
      expect(threadRow).toBeDefined();
      
      // Act
      threadRow!.nativeElement.click();

      // Assert
      expect(mockSession.setCurrentThread).not.toHaveBeenCalled();
    });

    it('should call setCurrentThread when the Focus button is clicked', async () => {
      // Arrange
      const threads = [{ id: 1, name: 'Main' }, { id: 2, name: 'Worker' }];
      mockSession.threads$.next(threads);
      mockSession.activeThreadId$.next(1); // Thread 1 is active
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 20));
      fixture.detectChanges();

      // Find Focus button for Thread 2 (it should be visible because it's not active)
      const focusButtons = fixture.debugElement.queryAll(By.css('.focus-button'));
      expect(focusButtons.length).toBe(1);

      // Act
      focusButtons[0].nativeElement.click();

      // Assert
      expect(mockSession.setCurrentThread).toHaveBeenCalledWith(2);
    });

    it('should NOT show Focus button for the currently active thread', async () => {
      // Arrange
      const threads = [{ id: 1, name: 'Main' }];
      mockSession.threads$.next(threads);
      mockSession.activeThreadId$.next(1);
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 20));
      fixture.detectChanges();

      // Assert
      const focusButton = fixture.debugElement.query(By.css('.focus-button'));
      expect(focusButton).toBeNull();
      
      const activeBadge = fixture.debugElement.query(By.css('.active-badge'));
      expect(activeBadge).not.toBeNull();
      expect(activeBadge.nativeElement.textContent).toContain('ACTIVE');
    });
  });

  describe('Auto-Expansion on Stop', () => {
    it('should automatically expand the active thread and fetch frames on stopped event', async () => {
      // Arrange
      const threads = [{ id: 1, name: 'Main' }];
      const frames = [{ id: 10, name: 'main()' } as any];
      mockSession.threads$.next(threads);
      mockSession.activeThreadId$.next(1);
      mockSession.stackTrace.mockResolvedValue({ success: true, body: { stackFrames: frames } });
      
      // Act - simulate stop
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 50)); // Wait for debounce + fetchFrames promise
      fixture.detectChanges();

      // Assert
      expect(mockSession.stackTrace).toHaveBeenCalledWith(1);
      
      // Verify tree expansion via component state
      const threadNode = component.dataSource[0].children?.[0];
      expect(threadNode?.children?.length).toBe(1);
      expect(threadNode?.children?.[0].label).toBe('main()');
    });

    it('should expand the active thread even if frames were already cached (override manual collapse)', async () => {
      // Arrange - setup cached frames
      const threads = [{ id: 1, name: 'Main' }];
      const frames = [{ id: 10, name: 'main()' } as any];
      mockSession.threads$.next(threads);
      mockSession.activeThreadId$.next(1);
      mockSession.stackTrace.mockResolvedValue({ success: true, body: { stackFrames: frames } });
      
      // First stop to populate cache
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 50));
      fixture.detectChanges();

      // Manually collapse the thread node (simulated via tree API)
      const threadNode = component.dataSource[0].children?.[0] as ExecutionNode;
      const tree = (component as any).tree;
      tree.collapse(threadNode);
      expect(tree.isExpanded(threadNode)).toBe(false);

      // Act - trigger another "stop" via transition (not just a re-push)
      mockSession.executionState$.next('running');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 20)); // Wait for debounce
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 50)); // Wait for auto-expansion
      fixture.detectChanges();

      // Assert - should be expanded again
      const newThreadNode = component.dataSource[0].children?.[0] as ExecutionNode;
      expect(tree.isExpanded(newThreadNode)).toBe(true);
    });
  });

  describe('Frame Interaction', () => {
    it('should emit frameSelected when a frame node is clicked', async () => {
      // Arrange
      const threads = [{ id: 1, name: 'Main' }];
      const frames = [{ id: 10, name: 'main()' } as any];
      mockSession.threads$.next(threads);
      mockSession.activeThreadId$.next(1);
      mockSession.stackTrace.mockResolvedValue({ success: true, body: { stackFrames: frames } });
      
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 20)); // Wait for debounce
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 50)); // Wait for fetchFrames
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.frameSelected, 'emit');

      // Act
      const frameElement = fixture.debugElement.queryAll(By.css('.mat-tree-node')).find(el => el.nativeElement.textContent.includes('main()'));
      expect(frameElement).toBeDefined();
      frameElement?.nativeElement.click();

      // Assert
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
    });
  });
});
