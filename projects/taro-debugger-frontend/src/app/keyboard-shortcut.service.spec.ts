import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { KeyboardShortcutService, ActionID } from './keyboard-shortcut.service';
import { firstValueFrom } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('KeyboardShortcutService', () => {
  let service: KeyboardShortcutService;
  let mockNgZone: any;

  beforeEach(() => {
    // Create a mock of NgZone to track zone entrance/exit
    mockNgZone = {
      runOutsideAngular: vi.fn((fn: Function) => fn()),
      run: vi.fn((fn: Function) => fn()),
    };

    TestBed.configureTestingModule({
      providers: [
        KeyboardShortcutService,
        { provide: NgZone, useValue: mockNgZone }
      ]
    });
    
    // The service constructor starts the listener
    service = TestBed.inject(KeyboardShortcutService);
  });

  describe('Global Action Mapping', () => {
    /** F5 (Continue): Ensure F5 key maps to ActionID.DEBUG_CONTINUE. */
    it('should map F5 to DEBUG_CONTINUE', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F5' });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_CONTINUE);
    });

    /** Shift+F5 (Stop): Ensure Shift+F5 maps to ActionID.DEBUG_STOP. */
    it('should map Shift+F5 to DEBUG_STOP', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F5', shiftKey: true });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_STOP);
    });

    /** Ctrl/Cmd+Shift+F5 (Restart): Ensure mapping for restart works on both Ctrl and Meta modifiers. */
    it('should map Ctrl+Shift+F5 to DEBUG_RESTART', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F5', shiftKey: true, ctrlKey: true });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_RESTART);
    });

    it('should map Meta+Shift+F5 to DEBUG_RESTART (macOS)', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F5', shiftKey: true, metaKey: true });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_RESTART);
    });

    /** F9 (Toggle Breakpoint): Ensure F9 maps correctly. */
    it('should map F9 to EDITOR_TOGGLE_BREAKPOINT', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F9' });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.EDITOR_TOGGLE_BREAKPOINT);
    });

    /** F10/F11/Shift+F11: Ensure stepping shortcuts map correctly. */
    it('should map F10 to DEBUG_STEP_OVER', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F10' });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_STEP_OVER);
    });

    it('should map F11 to DEBUG_STEP_INTO', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F11' });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_STEP_INTO);
    });

    it('should map Shift+F11 to DEBUG_STEP_OUT', async () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: 'F11', shiftKey: true });
      const actionPromise = firstValueFrom(service.onAction$);

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_STEP_OUT);
    });
  });

  describe('NG Zone Optimization', () => {
    /** Lazy Zone Entrance: Verify that random alphanumeric keystrokes do NOT trigger Angular change detection. */
    it('should listen outside Angular zone upon initialization', () => {
      // Assert
      expect(mockNgZone.runOutsideAngular).toHaveBeenCalled();
    });

    it('should NOT trigger zone re-entry for non-shortcut keys', () => {
      // Arrange
      mockNgZone.run.mockClear();
      const event = new KeyboardEvent('keydown', { key: 'a' });

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(mockNgZone.run).not.toHaveBeenCalled();
    });

    /** Shortcut Re-entry: Verify that a matched shortcut triggers a zone re-entry. */
    it('should trigger zone re-entry ONLY for matched shortcuts', () => {
      // Arrange
      mockNgZone.run.mockClear();
      const event = new KeyboardEvent('keydown', { key: 'F5' });

      // Act
      window.dispatchEvent(event);

      // Assert
      expect(mockNgZone.run).toHaveBeenCalled();
    });
  });

  describe('Focus Guards', () => {
    /** Standard Input Inhibition: Verify that shortcuts are ignored when focus is in a standard <input>. */
    it('should ignore shortcuts when focused in an INPUT element', async () => {
      // Arrange
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      
      let actionTriggered = false;
      const sub = service.onAction$.subscribe(() => actionTriggered = true);
      const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true });

      // Act
      input.dispatchEvent(event);

      // Assert
      expect(actionTriggered).toBe(false);

      // Cleanup
      sub.unsubscribe();
      document.body.removeChild(input);
    });

    /** Monaco Whitelist: Verify that shortcuts are NOT ignored when focus is in a textarea with the .inputarea class. */
    it('should NOT ignore shortcuts when focused in Monaco Editor textarea', async () => {
      // Arrange
      const textarea = document.createElement('textarea');
      textarea.classList.add('inputarea'); // Monaco's target class
      document.body.appendChild(textarea);
      textarea.focus();
      
      const actionPromise = firstValueFrom(service.onAction$);
      const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true });

      // Act
      textarea.dispatchEvent(event);

      // Assert
      expect(await actionPromise).toBe(ActionID.DEBUG_CONTINUE);

      // Cleanup
      document.body.removeChild(textarea);
    });

    it('should ignore shortcuts in standard TEXTAREA', async () => {
       // Arrange
       const textarea = document.createElement('textarea');
       document.body.appendChild(textarea);
       textarea.focus();
       
       let actionTriggered = false;
       const sub = service.onAction$.subscribe(() => actionTriggered = true);
       const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true });
 
       // Act
       textarea.dispatchEvent(event);
 
       // Assert
       expect(actionTriggered).toBe(false);
 
       // Cleanup
       sub.unsubscribe();
       document.body.removeChild(textarea);
    });
  });

  describe('Event Handling', () => {
    /** Prevent Default: Ensure preventDefault() and stopPropagation() are called ONLY when a shortcut matches. */
    it('should prevent default and stop propagation ONLY on match', () => {
      // Arrange
      const matchEvent = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
      const noMatchEvent = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      
      vi.spyOn(matchEvent, 'preventDefault');
      vi.spyOn(matchEvent, 'stopPropagation');
      vi.spyOn(noMatchEvent, 'preventDefault');
      vi.spyOn(noMatchEvent, 'stopPropagation');

      // Act
      window.dispatchEvent(matchEvent);
      window.dispatchEvent(noMatchEvent);

      // Assert
      expect(matchEvent.preventDefault).toHaveBeenCalled();
      expect(matchEvent.stopPropagation).toHaveBeenCalled();
      expect(noMatchEvent.preventDefault).not.toHaveBeenCalled();
      expect(noMatchEvent.stopPropagation).not.toHaveBeenCalled();
    });
  });
});
