import { TestBed } from '@angular/core/testing';
import { BreakpointsComponent } from './breakpoints.component';
import { DapSessionService, VerifiedBreakpoint } from '@taro/dap-core';
import { of, BehaviorSubject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('BreakpointsComponent (WI-71)', () => {
  let component: BreakpointsComponent;
  let mockDapSession: any;
  let breakpointsSubject: BehaviorSubject<Map<string, VerifiedBreakpoint[]>>;

  beforeEach(() => {
    breakpointsSubject = new BehaviorSubject<Map<string, VerifiedBreakpoint[]>>(new Map());
    mockDapSession = {
      breakpoints$: breakpointsSubject.asObservable(),
      toggleBreakpointEnabled: vi.fn(),
      removeBreakpoint: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        BreakpointsComponent,
        { provide: DapSessionService, useValue: mockDapSession }
      ]
    });

    component = TestBed.inject(BreakpointsComponent);
  });

  it('should transform breakpoints Map into sorted grouped array', async () => {
    // Arrange
    const bpsMap = new Map<string, VerifiedBreakpoint[]>();
    bpsMap.set('/root/b.c', [
      { line: 20, verified: true, enabled: true },
      { line: 5, verified: false, enabled: false }
    ]);
    bpsMap.set('/root/a.c', [
      { line: 10, verified: true, enabled: true }
    ]);
    bpsMap.set('/root/empty.c', []);

    // Act
    breakpointsSubject.next(bpsMap);

    // Assert
    component.groupedBreakpoints$.subscribe(groups => {
      expect(groups.length).toBe(2); // 'empty.c' should be filtered out
      
      // Sorted by filename (a.c before b.c)
      expect(groups[0].fileName).toBe('a.c');
      expect(groups[1].fileName).toBe('b.c');
      
      // Sorted by line number (5 before 20) in b.c
      expect(groups[1].breakpoints[0].line).toBe(5);
      expect(groups[1].breakpoints[1].line).toBe(20);
    });
  });

  it('should emit requestReveal when onBreakpointClick is called', () => {
    // Arrange
    const spy = vi.spyOn(component.requestReveal, 'emit');
    const path = '/src/main.c';
    const line = 15;

    // Act
    component.onBreakpointClick(path, line);

    // Assert
    expect(spy).toHaveBeenCalledWith({ path, line });
  });

  it('should call session service toggleBreakpointEnabled when toggleEnabled is called', () => {
    // Arrange
    const path = '/src/main.c';
    const line = 15;
    const event = { checked: true } as any;

    // Act
    component.toggleEnabled(event, path, line);

    // Assert
    expect(mockDapSession.toggleBreakpointEnabled).toHaveBeenCalledWith(path, line);
  });

  it('should call session service removeBreakpoint when removeBreakpoint is called', () => {
    // Arrange
    const path = '/src/main.c';
    const line = 15;
    const event = { stopPropagation: vi.fn() } as any;

    // Act
    component.removeBreakpoint(event, path, line);

    // Assert
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(mockDapSession.removeBreakpoint).toHaveBeenCalledWith(path, line);
  });
});
