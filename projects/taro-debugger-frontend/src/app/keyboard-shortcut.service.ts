import { Injectable, NgZone, inject } from '@angular/core';
import { Subject, Observable, fromEvent } from 'rxjs';

/** 
 * Unique identifiers for supported keyboard actions.
 * Mapped from VS Code's default debug keybindings.
 */
export enum ActionID {
  DEBUG_CONTINUE = 'debug.continue',
  DEBUG_PAUSE = 'debug.pause',
  DEBUG_STEP_OVER = 'debug.stepOver',
  DEBUG_STEP_INTO = 'debug.stepInto',
  DEBUG_STEP_OUT = 'debug.stepOut',
  DEBUG_RESTART = 'debug.restart',
  DEBUG_STOP = 'debug.stop',
  EDITOR_TOGGLE_BREAKPOINT = 'editor.toggleBreakpoint',
}

/**
 * Service to handle global keyboard shortcuts outside of the Angular Zone
 * to optimize performance and provide IDE-like global interaction.
 */
@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutService {
  private readonly ngZone = inject(NgZone);
  private readonly actionSubject = new Subject<ActionID>();

  /** Stream of identified keyboard actions */
  public readonly onAction$: Observable<ActionID> = this.actionSubject.asObservable();

  constructor() {
    this.initGlobalListener();
  }

  /**
   * Initializes the global keydown listener outside the Angular zone
   * to avoid triggering a Change Detection cycle on every keystroke.
   */
  private initGlobalListener(): void {
    this.ngZone.runOutsideAngular(() => {
      // Use standard capture to ensure we get events before most components
      fromEvent<KeyboardEvent>(window, 'keydown', { capture: true }).subscribe((event) => {
        const action = this.mapEventToAction(event);
        if (action) {
          // Identify a valid shortcut: re-enter Angular zone for broadcast
          this.ngZone.run(() => {
            event.preventDefault();
            event.stopPropagation();
            this.actionSubject.next(action);
          });
        }
      });
    });
  }

  private mapEventToAction(event: KeyboardEvent): ActionID | null {
    if (this.shouldIgnoreEvent(event)) return null;

    const key = event.key;
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey;
    const isMeta = event.metaKey; // Command key on macOS

    // F5 family (Continue / Stop / Restart)
    if (key === 'F5') {
      // Restart: Ctrl+Shift+F5 (Win/Linux) or Cmd+Shift+F5 (macOS)
      if ((isCtrl || isMeta) && isShift) return ActionID.DEBUG_RESTART;
      // Stop: Shift+F5
      if (isShift) return ActionID.DEBUG_STOP;
      // Continue: F5
      return ActionID.DEBUG_CONTINUE;
    }

    // F6: Pause
    if (key === 'F6') return ActionID.DEBUG_PAUSE;

    // F9: Toggle Breakpoint
    if (key === 'F9') return ActionID.EDITOR_TOGGLE_BREAKPOINT;

    // F10: Step Over
    if (key === 'F10') return ActionID.DEBUG_STEP_OVER;

    // F11 family (Step Into / Step Out)
    if (key === 'F11') {
      if (isShift) return ActionID.DEBUG_STEP_OUT;
      return ActionID.DEBUG_STEP_INTO;
    }

    return null;
  }

  /**
   * Determines if the event should be ignored based on focus context.
   * Whitelists the Monaco Editor's hidden input area to ensure debug 
   * shortcuts work while editing source code.
   */
  private shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    if (!target) return false;

    const tagName = target.tagName;
    
    // Ignore if typing in a standard input or select
    if (tagName === 'INPUT' || tagName === 'SELECT') {
      return true;
    }

    // For TEXTAREA, skip only if it's NOT the Monaco Editor area
    if (tagName === 'TEXTAREA') {
      // Monaco uses a textarea with class 'inputarea'
      return !target.classList.contains('inputarea');
    }

    return false;
  }
}
