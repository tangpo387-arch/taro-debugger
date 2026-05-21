import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreadCallStackComponent, ExecutionNode } from './thread-call-stack.component';
import { DapSessionService, DapThread, DapStackFrame, DapConfigService } from '@taro/dap-core';

function makeMockDapSession(overrides: Partial<DapSessionService> = {}) {
  const threads$ = new BehaviorSubject<any[]>([]);
  const activeThread$ = new BehaviorSubject<any>(null);
  const executionState$ = new BehaviorSubject<string>('idle');
  const processInfo$ = new BehaviorSubject<any>(null);
  const eventSubject = new Subject<any>();

  return {
    threads$,
    activeThread$,
    executionState$,
    processInfo$,
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

  function makeMockThreadSession(id: number, name: string, frames: DapStackFrame[] = [], startWithCache = false) {
    const thread: any = {
      id,
      name,
      cachedFrames: startWithCache ? frames : undefined,
      isLoadingStackTrace: false,
      stopReason: null,
      get status() {
        return mockSession?.executionState$.value === 'stopped' ? 'stopped' : 'running';
      }
    };
    thread.stackTrace = vi.fn().mockImplementation(async () => {
      thread.isLoadingStackTrace = true;
      thread.cachedFrames = frames;
      thread.isLoadingStackTrace = false;
      return frames;
    });
    return thread;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('Explicit Thread Selection', () => {
    it('should NOT call setCurrentThread when a thread row label is clicked', async () => {
      // Arrange
      const threads = [makeMockThreadSession(1, 'Main')];
      mockSession.threads$.next(threads);
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
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
      const threads = [makeMockThreadSession(1, 'Main'), makeMockThreadSession(2, 'Worker')];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any); // Thread 1 is active
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();

      // Find Focus button for Thread 2 (it should be visible because it's not active)
      const focusButtons = fixture.debugElement.queryAll(By.css('.focus-button'));
      expect(focusButtons.length).toBe(1);

      // Act
      focusButtons[0].nativeElement.click();

      // Assert
      expect(mockSession.setCurrentThread).toHaveBeenCalledWith(threads[1]);
    });

    it('should NOT show Focus button for the currently active thread', async () => {
      // Arrange
      const threads = [makeMockThreadSession(1, 'Main')];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any);
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
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
      const frames = [{ id: 10, name: 'main()' } as any];
      const threads = [makeMockThreadSession(1, 'Main', frames)];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any);
      
      // Act - simulate stop
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();
      
      await vi.advanceTimersByTimeAsync(1); // Flush the stackTrace promise microtask queue
      fixture.detectChanges();
      
      await vi.advanceTimersByTimeAsync(10); // Wait for cache update debounceTime(10)
      fixture.detectChanges();

      // Assert
      expect(threads[0].stackTrace).toHaveBeenCalled();
      
      // Verify tree expansion via component state
      const threadNode = component.dataSource[0].children?.[0];
      expect(threadNode?.children?.length).toBe(1);
      expect(threadNode?.children?.[0].label).toBe('main()');
    });

    it('should expand the active thread even if frames were already cached (override manual collapse)', async () => {
      // Arrange - setup cached frames
      const frames = [{ id: 10, name: 'main()' } as any];
      const threads = [makeMockThreadSession(1, 'Main', frames)];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any);
      
      // First stop to populate cache
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();
      
      await vi.advanceTimersByTimeAsync(1); // Flush fetchFrames microtask
      fixture.detectChanges();
      
      await vi.advanceTimersByTimeAsync(10); // Wait for cache update debounceTime(10)
      fixture.detectChanges();

      // Manually collapse the thread node (simulated via tree API)
      const threadNode = component.dataSource[0].children?.[0] as ExecutionNode;
      const tree = (component as any).tree;
      tree.collapse(threadNode);
      expect(tree.isExpanded(threadNode)).toBe(false);

      // Act - trigger another "stop" via transition (not just a re-push)
      mockSession.executionState$.next('running');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();
      
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();

      // Assert - should be expanded again
      const newThreadNode = component.dataSource[0].children?.[0] as ExecutionNode;
      expect(tree.isExpanded(newThreadNode)).toBe(true);
    });
  });

  describe('Frame Interaction', () => {
    it('should emit frameSelected when a frame node is clicked', async () => {
      // Arrange
      const frames = [{ id: 10, name: 'main()' } as any];
      const threads = [makeMockThreadSession(1, 'Main', frames)];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any);
      
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();
      
      await vi.advanceTimersByTimeAsync(1); // Flush fetchFrames microtask
      fixture.detectChanges();
      
      await vi.advanceTimersByTimeAsync(10); // Wait for cache update debounceTime(10)
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

  describe('Node Expansion and Event Propagation', () => {
    it('should toggle thread node expansion when clicking anywhere on the thread row', async () => {
      // Arrange
      const threads = [makeMockThreadSession(1, 'Main', [], true)];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any);
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();

      const tree = (component as any).tree;
      const threadNode = component.dataSource[0].children?.[0] as ExecutionNode;
      tree.expand(threadNode);
      expect(tree.isExpanded(threadNode)).toBe(true);

      // Collapse the thread node first
      tree.collapse(threadNode);
      expect(tree.isExpanded(threadNode)).toBe(false);

      // Query the thread row element
      const threadRows = fixture.debugElement.queryAll(By.css('.mat-tree-node'));
      const threadRow = threadRows.find(el => el.nativeElement.textContent.includes('Main'));
      expect(threadRow).toBeDefined();

      // Act - Click the row
      threadRow!.nativeElement.click();
      fixture.detectChanges();

      // Assert
      expect(tree.isExpanded(threadNode)).toBe(true);
    });

    it('should toggle thread node expansion exactly once when clicking the tree-toggle-button (chevron)', async () => {
      // Arrange
      const threads = [makeMockThreadSession(1, 'Main', [], true)];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any);
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();

      const tree = (component as any).tree;
      const threadNode = component.dataSource[0].children?.[0] as ExecutionNode;
      tree.expand(threadNode);
      expect(tree.isExpanded(threadNode)).toBe(true);

      // Collapse it
      tree.collapse(threadNode);
      expect(tree.isExpanded(threadNode)).toBe(false);

      // Find the toggle button
      const threadRows = fixture.debugElement.queryAll(By.css('.mat-tree-node'));
      const threadRow = threadRows.find(el => el.nativeElement.textContent.includes('Main'));
      const toggleBtn = threadRow!.query(By.css('.tree-toggle-button'));
      expect(toggleBtn).not.toBeNull();

      // Act - Click the toggle button
      toggleBtn.nativeElement.click();
      fixture.detectChanges();

      // Assert
      expect(tree.isExpanded(threadNode)).toBe(true);
    });

    it('should NOT toggle thread node expansion when clicking the focus button', async () => {
      // Arrange
      const threads = [makeMockThreadSession(1, 'Main'), makeMockThreadSession(2, 'Worker')];
      mockSession.threads$.next(threads);
      mockSession.activeThread$.next({ id: 1 } as any); // Main is active
      mockSession.executionState$.next('stopped');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10); // Wait for debounceTime(10)
      fixture.detectChanges();

      const tree = (component as any).tree;
      // Worker thread is not active and not expanded by default
      const workerNode = component.dataSource[0].children?.[1] as ExecutionNode;
      expect(tree.isExpanded(workerNode)).toBe(false);

      const threadRows = fixture.debugElement.queryAll(By.css('.mat-tree-node'));
      const workerRow = threadRows.find(el => el.nativeElement.textContent.includes('Worker'));
      const focusBtn = workerRow!.query(By.css('.focus-button'));
      expect(focusBtn).not.toBeNull();

      // Act - Click the focus button
      focusBtn.nativeElement.click();
      fixture.detectChanges();

      // Assert
      expect(tree.isExpanded(workerNode)).toBe(false); // remains collapsed
      expect(mockSession.setCurrentThread).toHaveBeenCalledWith(threads[1]);
    });
  });
});
