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

  // View Toggles
  VIEW_TOGGLE_EXPLORER = 'view.toggleExplorer',
  VIEW_TOGGLE_INSPECTION = 'view.toggleInspection',
  VIEW_TOGGLE_CONSOLE = 'view.toggleConsole',
  VIEW_RESET_LAYOUT = 'view.resetLayout',
  CONSOLE_FOCUS = 'console.focus',

  // File Operations
  FILE_NEW_SESSION = 'file.newSession',
  FILE_CLOSE_SESSION = 'file.closeSession',
  FILE_EXIT = 'file.exit',

  // Help
  HELP_DOCS = 'help.docs',
  HELP_ABOUT = 'help.about',
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
    this.initElectronListener();
  }

  /**
   * Listens for menu actions sent from the Electron main process.
   */
  private initElectronListener(): void {
    const electron = (window as any).electronAPI;
    if (electron?.on) {
      electron.on('menu-action', (actionId: ActionID) => {
        this.ngZone.run(() => {
          this.actionSubject.next(actionId);
        });
      });
    }
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

    // View Toggles
    const isPureCtrlOrMeta = (isCtrl || isMeta) && !isShift && !event.altKey;
    const isCtrlAltOrMetaAlt = (isCtrl || isMeta) && event.altKey && !isShift;

    if (isCtrlAltOrMetaAlt && key.toLowerCase() === 'b') return ActionID.VIEW_TOGGLE_INSPECTION;
    if (isPureCtrlOrMeta && key.toLowerCase() === 'b') return ActionID.VIEW_TOGGLE_EXPLORER;
    if ((isCtrl || isMeta) && key === '`') return ActionID.VIEW_TOGGLE_CONSOLE;
    if ((isCtrl || isMeta) && isShift && key.toLowerCase() === 'y') return ActionID.CONSOLE_FOCUS;

    // File Operations
    if ((isCtrl || isMeta) && key.toLowerCase() === 'w') return ActionID.FILE_CLOSE_SESSION;

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
      // Whitelist the debug console input so F5/F10/etc work while typing (WI-92)
      return target.id !== 'evaluate-expression-input';
    }

    // For TEXTAREA, skip only if it's NOT the Monaco Editor area
    if (tagName === 'TEXTAREA') {
      // Monaco uses a textarea with class 'inputarea'
      return !target.classList.contains('inputarea');
    }

    return false;
  }
}
