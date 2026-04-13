/**
 * @file component.spec.example.ts
 * @description Angular component unit test template for the taro-debugger project.
 *
 * Usage:
 *   1. Copy this file to src/app/<your-component>.spec.ts
 *   2. Replace all occurrences of `ExampleComponent` with your component class name.
 *   3. Update the imports and mock providers to match the component's actual dependencies.
 *   4. Map each spec-plan heading to an `it()` block inside the appropriate `describe()`.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { EMPTY } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from '@angular/core';

// ── Replace with your actual imports ──────────────────────────────────────────
import { ExampleComponent } from './example.component';
import { DapSessionService } from './dap-session.service';
import { DapConfigService } from './dap-config.service';

// ── Mock Factories ────────────────────────────────────────────────────────────

function makeMockDapSession(overrides: Partial<DapSessionService> = {}): Partial<DapSessionService> {
  return {
    sendRequest: vi.fn().mockResolvedValue({ success: true, body: {} }),
    onEvent: vi.fn().mockReturnValue(EMPTY),
    executionState$: new BehaviorSubject<string>('idle') as any,
    capabilities: { supportsLoadedSourcesRequest: true } as any,
    ...overrides,
  };
}

function makeMockConfigService(overrides = {}) {
  return {
    getConfig: vi.fn().mockReturnValue({ sourcePath: '/root/project' }),
    ...overrides,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('ExampleComponent', () => {
  let fixture: ComponentFixture<ExampleComponent>;
  let component: ExampleComponent;
  let mockSession: ReturnType<typeof makeMockDapSession>;
  let mockConfig: ReturnType<typeof makeMockConfigService>;

  beforeEach(async () => {
    mockSession = makeMockDapSession();
    mockConfig = makeMockConfigService();

    await TestBed.configureTestingModule({
      // For Standalone Components, use `imports` instead of `declarations`.
      imports: [ExampleComponent],
      providers: [
        { provide: DapSessionService, useValue: mockSession },
        { provide: DapConfigService, useValue: mockConfig },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;

    // Set any required @Input() values before the first change detection.
    // component.someInput = 0;

    fixture.detectChanges(); // Triggers ngOnInit
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  // ── Group: @Input() change detection ──────────────────────────────────────

  describe('@Input() reloadTrigger', () => {
    it('should NOT call getTree() when reloadTrigger is 0 (first-change guard)', () => {
      // Arrange — trigger starts at 0 from beforeEach setup
      const getSpy = vi.spyOn(mockSession as any, 'sendRequest');

      // Act — initial detectChanges already fired in beforeEach

      // Assert
      expect(getSpy).not.toHaveBeenCalled();
    });

    it('should call getTree() exactly once when reloadTrigger increments to 1', async () => {
      // Arrange
      const getTreeSpy = vi.fn().mockResolvedValue({ children: [] });
      // Wire spy into the service façade if needed
      // (mockSession.fileTree as any).getTree = getTreeSpy;

      // Act
      component.reloadTrigger = 1;
      fixture.detectChanges();
      await fixture.whenStable();

      // Assert
      expect(getTreeSpy).toHaveBeenCalledOnce();
    });
  });

  // ── Group: @Output() EventEmitter ─────────────────────────────────────────

  describe('@Output() fileSelected', () => {
    it('should emit the node object when a file node is clicked', () => {
      // Arrange
      const emittedValues: any[] = [];
      component.fileSelected.subscribe((v: any) => emittedValues.push(v));
      const fileNode = { type: 'file', path: '/src/main.cpp', name: 'main.cpp' };

      // Act
      component.onNodeClick(fileNode as any);

      // Assert
      expect(emittedValues).toHaveLength(1);
      expect(emittedValues[0]).toBe(fileNode);
    });

    it('should NOT emit when a directory node is clicked', () => {
      // Arrange
      const emittedValues: any[] = [];
      component.fileSelected.subscribe((v: any) => emittedValues.push(v));
      const dirNode = { type: 'directory', path: '/src', name: 'src' };

      // Act
      component.onNodeClick(dirNode as any);

      // Assert
      expect(emittedValues).toHaveLength(0);
    });
  });

  // ── Group: DOM / CSS class assertions ─────────────────────────────────────

  describe('activeFilePath highlight', () => {
    it('should apply "active-file" CSS class to the matching node button', async () => {
      // Arrange
      component.activeFilePath = '/src/main.cpp';
      // Populate the data source with a matching node
      // component.fileDataSource = [{ path: '/src/main.cpp', type: 'file', name: 'main.cpp' }];

      // Act
      fixture.detectChanges();
      await fixture.whenStable();

      // Assert — query the rendered DOM
      const activeButton = fixture.debugElement.query(By.css('.active-file'));
      expect(activeButton).not.toBeNull();
    });

    it('should remove "active-file" class when activeFilePath is set to null', async () => {
      // Arrange — first apply the class
      component.activeFilePath = '/src/main.cpp';
      fixture.detectChanges();

      // Act — then clear it
      component.activeFilePath = null;
      fixture.detectChanges();
      await fixture.whenStable();

      // Assert
      const activeButton = fixture.debugElement.query(By.css('.active-file'));
      expect(activeButton).toBeNull();
    });
  });

  // ── Group: @ViewChild delegation ──────────────────────────────────────────

  describe('collapseAll()', () => {
    it('should delegate to matTree.collapseAll()', () => {
      // Arrange
      const collapseAllSpy = vi.fn();
      // Inject spy into the ViewChild reference
      (component as any).matTree = { collapseAll: collapseAllSpy };

      // Act
      component.collapseAll();

      // Assert
      expect(collapseAllSpy).toHaveBeenCalledOnce();
    });
  });

  // ── Group: Subscription lifecycle ─────────────────────────────────────────

  describe('ngOnDestroy()', () => {
    it('should unsubscribe from long-running Observables on component destroy', () => {
      // Arrange — create a never-completing Observable scenario
      // The fixture.destroy() call triggers ngOnDestroy.
      // We verify no subscription-after-destroy errors surface.

      // Act
      expect(() => fixture.destroy()).not.toThrow();

      // Assert — additional checks if the component exposes subscription state
    });
  });
});
