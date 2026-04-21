import { TestBed } from '@angular/core/testing';
import { EditorComponent } from './editor.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { DapConfigService } from '@taro/dap-core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

describe('EditorComponent', () => {
  let component: EditorComponent;

  beforeEach(() => {
    const mockBreakpointObserver = {
      observe: vi.fn().mockReturnValue(of({ matches: false }))
    };

    /**
     * Strategy: Manual instantiation via TestBed providers.
     * This bypasses the component factory and template rendering, which avoids
     * issues with MonacoEditorModule in a headless/JSDOM environment.
     */
    TestBed.configureTestingModule({
      providers: [
        EditorComponent,
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: DapConfigService, useValue: { getConfig: () => ({}) } },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } }
      ]
    });

    component = TestBed.inject(EditorComponent);
    
    // Mock global monaco object for internal decoration logic
    (window as any).monaco = {
      Range: function() { return {}; },
      editor: {
        MouseTargetType: { GUTTER_GLYPH_MARGIN: 1 }
      }
    };
  });

  describe('toggleBreakpointAtCurrentPosition()', () => {
    /** 
     * Verify that F9 interaction correctly identifies the Monaco editor's 
     * current cursor position and delegates to the internal toggle logic.
     */
    it('should call toggleBreakpoint with the current cursor line number', () => {
      // Arrange
      // Mock Monaco's getPosition() API
      const mockPosition = { lineNumber: 42 };
      const mockEditor = {
        getPosition: vi.fn().mockReturnValue(mockPosition),
        deltaDecorations: vi.fn().mockReturnValue([])
      };
      
      // Inject the mock instance and a dummy filename
      (component as any).editorInstance = mockEditor;
      component.filename = 'test.cpp';
      
      const toggleSpy = vi.spyOn(component, 'toggleBreakpoint');

      // Act
      component.toggleBreakpointAtCurrentPosition();

      // Assert
      expect(mockEditor.getPosition).toHaveBeenCalled();
      expect(toggleSpy).toHaveBeenCalledWith(42);
    });

    it('should do nothing if editorInstance is not initialized', () => {
       // Arrange
       (component as any).editorInstance = null;
       const toggleSpy = vi.spyOn(component, 'toggleBreakpoint');
       
       // Act
       component.toggleBreakpointAtCurrentPosition();
       
       // Assert
       expect(toggleSpy).not.toHaveBeenCalled();
    });
  });

  describe('View State Persistence', () => {
    let mockEditor: any;

    beforeEach(() => {
      mockEditor = {
        saveViewState: vi.fn(),
        restoreViewState: vi.fn(),
        updateOptions: vi.fn(),
        getModel: vi.fn().mockReturnValue({}),
        deltaDecorations: vi.fn().mockReturnValue([]),
        revealLineInCenter: vi.fn(),
        setPosition: vi.fn()
      };
      (window as any).monaco.editor = {
        setModelLanguage: vi.fn()
      };
      (component as any).editorInstance = mockEditor;
    });

    it('should save view state when filename changes', () => {
      // Arrange
      component.filename = 'file1.cpp';
      const mockState = { cursor: 10 };
      mockEditor.saveViewState.mockReturnValue(mockState);

      // Act
      const changes = {
        filename: {
          previousValue: 'file1.cpp',
          currentValue: 'file2.cpp',
          firstChange: false,
          isFirstChange: () => false
        }
      };
      component.ngOnChanges(changes as any);

      // Assert
      expect(mockEditor.saveViewState).toHaveBeenCalled();
      expect((component as any).viewStates.get('file1.cpp')).toBe(mockState);
    });

    it('should restore view state when switching back to a file', async () => {
      // Arrange
      const mockState = { cursor: 10 };
      (component as any).viewStates.set('file1.cpp', mockState);
      component.filename = 'file1.cpp';

      // Act
      component.ngOnChanges({
        filename: {
          previousValue: 'file2.cpp',
          currentValue: 'file1.cpp',
          firstChange: false,
          isFirstChange: () => false
        }
      } as any);

      // The restore happens in the debounced updateQueue$ subscriber
      // Wait for it (UPDATE_DEBOUNCE_MS is 50ms)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockEditor.restoreViewState).toHaveBeenCalledWith(mockState);
    });

    it('should not restore if no state exists for the file', async () => {
      // Arrange
      component.filename = 'new-file.cpp';

      // Act
      component.ngOnChanges({
        filename: {
          previousValue: 'file2.cpp',
          currentValue: 'new-file.cpp',
          firstChange: false,
          isFirstChange: () => false
        }
      } as any);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockEditor.restoreViewState).not.toHaveBeenCalled();
    });

    it('should NOT snap to active line if state was restored and no reveal was requested', async () => {
      // Arrange
      const mockState = { cursor: 10 };
      (component as any).viewStates.set('file1.cpp', mockState);
      component.filename = 'file1.cpp';
      component.activeLine = 42;
      (component as any).lastProcessedRevealTrigger = 0;
      component.revealTrigger = 0;

      // Act
      component.ngOnChanges({
        filename: {
          previousValue: 'file2.cpp',
          currentValue: 'file1.cpp'
        }
      } as any);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockEditor.restoreViewState).toHaveBeenCalledWith(mockState);
      expect(mockEditor.revealLineInCenter).not.toHaveBeenCalled();
    });

    it('should snap to active line if revealTrigger was incremented even if state was restored', async () => {
      // Arrange
      const mockState = { cursor: 10 };
      (component as any).viewStates.set('file1.cpp', mockState);
      component.filename = 'file1.cpp';
      component.activeLine = 42;
      (component as any).lastProcessedRevealTrigger = 0;
      component.revealTrigger = 1;

      // Act
      component.ngOnChanges({
        filename: {
          previousValue: 'file2.cpp',
          currentValue: 'file1.cpp'
        },
        revealTrigger: {
          previousValue: 0,
          currentValue: 1
        }
      } as any);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockEditor.restoreViewState).toHaveBeenCalledWith(mockState);
      expect(mockEditor.revealLineInCenter).toHaveBeenCalledWith(42);
    });
  });

  describe('breakpointsChange Debounce (R-CS4)', () => {
    beforeEach(() => {
      // Mock editor instance needed for decoration update triggered by toggleBreakpoint
      (component as any).editorInstance = {
        deltaDecorations: vi.fn().mockReturnValue([])
      };
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce multiple rapid clicks on the same file', () => {
      const emitSpy = vi.spyOn(component.breakpointsChange, 'emit');
      component.filename = 'test.cpp';

      // Act: Simulate 3 rapid toggles
      component.toggleBreakpoint(10);
      component.toggleBreakpoint(20);
      component.toggleBreakpoint(30);

      // Assert: No emission should have occurred yet due to 150ms debounce
      expect(emitSpy).not.toHaveBeenCalled();

      // Advance time by 149ms
      vi.advanceTimersByTime(149);
      expect(emitSpy).not.toHaveBeenCalled();

      // Advance to 150ms
      vi.advanceTimersByTime(1);
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
        file: 'test.cpp',
        lines: expect.arrayContaining([10, 20, 30])
      }));
    });

    it('should NOT debounce clicks across different files (independent groups)', () => {
      const emitSpy = vi.spyOn(component.breakpointsChange, 'emit');

      // Act: Click on file A
      component.filename = 'fileA.cpp';
      component.toggleBreakpoint(10);

      // Act: Switch to file B and click
      component.filename = 'fileB.cpp';
      component.toggleBreakpoint(20);

      // Assert: Both streams should emit their results after the debounce window
      vi.advanceTimersByTime(150);
      
      expect(emitSpy).toHaveBeenCalledTimes(2);
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ file: 'fileA.cpp', lines: [10] }));
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ file: 'fileB.cpp', lines: [20] }));
    });
  });
});
