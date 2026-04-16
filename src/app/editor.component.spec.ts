import { TestBed } from '@angular/core/testing';
import { EditorComponent } from './editor.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { DapConfigService } from './dap-config.service';
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
});
