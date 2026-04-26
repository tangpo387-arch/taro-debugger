import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DebuggerComponent } from './debugger.component';
import { DapSessionService } from '@taro/dap-core';
import { DapVariablesService } from '@taro/ui-inspection';
import { DapAssemblyService } from '@taro/ui-assembly';
import { DapFileTreeService } from './dap-file-tree.service';
import { DapLogService } from '@taro/ui-console';
import { DapConfigService } from '@taro/dap-core';
import { Router } from '@angular/router';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { ChangeDetectorRef } from '@angular/core';
import { of, EMPTY, BehaviorSubject, delay } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Frame Switch Integration', () => {
  let component: DebuggerComponent;
  let mockDapSession: any;
  let mockVariablesService: any;
  let mockAssemblyService: any;
  let mockFileTreeService: any;

  beforeEach(() => {
    mockDapSession = {
      connectionStatus$: EMPTY,
      executionState$: new BehaviorSubject<string>('stopped').asObservable(),
      onEvent: () => EMPTY,
      onTraffic$: EMPTY,
      startSession: vi.fn().mockResolvedValue({}),
      disconnect: vi.fn(),
      threads: vi.fn().mockResolvedValue({ body: { threads: [] } }),
      breakpoints$: new BehaviorSubject(new Map()).asObservable(),
    };

    // We use a real-ish BehaviorSubject for scopes to verify updates
    const scopesSubject = new BehaviorSubject<any[]>([]);
    let lastFrameId: number | null = null;

    mockVariablesService = {
      scopes$: scopesSubject.asObservable(),
      fetchScopes: vi.fn().mockImplementation(async (frameId: number) => {
        lastFrameId = frameId;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        if (lastFrameId === frameId) {
          scopesSubject.next([{ name: `Scopes for ${frameId}`, variablesReference: frameId, expensive: false }]);
        }
      }),
      clear: vi.fn()
    };

    mockAssemblyService = {
      fetchInstructions: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return [];
      }),
      clear: vi.fn()
    };

    mockFileTreeService = {
      readFile: vi.fn().mockImplementation((path: string) => {
        // Return observable with delay to test switchMap cancellation
        return of(`Code for ${path}`).pipe(delay(50));
      }),
      getTree: () => EMPTY,
      destroy: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        DebuggerComponent,
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapVariablesService, useValue: mockVariablesService },
        { provide: DapAssemblyService, useValue: mockAssemblyService },
        { provide: DapFileTreeService, useValue: mockFileTreeService },
        { provide: DapLogService, useValue: { consoleLog: vi.fn(), appendDapLog: vi.fn() } },
        { provide: DapConfigService, useValue: { getConfig: () => ({ executablePath: 'exe' }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
      ]
    });

    component = TestBed.inject(DebuggerComponent);
    // Initialize the component (triggers initFrameSelectionStream)
    component.ngOnInit();
  });

  it('should only render the last frame data when multiple frames are clicked rapidly', async () => {
    const frame1 = { id: 1, name: 'frame1', line: 10, source: { path: 'file1.cpp' } } as any;
    const frame2 = { id: 2, name: 'frame2', line: 20, source: { path: 'file2.cpp' } } as any;

    // 1. Click frame 1
    component.onFrameClick(frame1);
    
    // 2. Click frame 2 immediately (before 50ms delay)
    component.onFrameClick(frame2);

    // Wait for all async tasks to settle (more than 50ms)
    await new Promise(resolve => setTimeout(resolve, 150));

    // Assert: Only frame 2's data should be set
    expect(component.activeFrameId).toBe(2);
    expect(component.currentCode).toBe('Code for file2.cpp');
    
    // Verify Scopes (via mockVariablesService implementation)
    const currentScopes = await new Promise(resolve => (component as any).variablesService.scopes$.subscribe(resolve));
    expect(currentScopes).toEqual([{ name: 'Scopes for 2', variablesReference: 2, expensive: false }]);

    // Verify fetchScopes was called for both, but only the last one should have updated the SSOT
    // (In our mock, the lastFrameId check handles this)
    expect(mockVariablesService.fetchScopes).toHaveBeenCalledWith(1);
    expect(mockVariablesService.fetchScopes).toHaveBeenCalledWith(2);
  });
});
