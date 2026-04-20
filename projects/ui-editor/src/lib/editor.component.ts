import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  NgZone,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { DapConfigService } from '@taro/dap-core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { LAYOUT_COMPACT_MQ } from './layout.config';
/** Payload emitted when breakpoints change in the editor */
export interface BreakpointChangeEvent {
  /** Absolute path of the source file whose breakpoints changed */
  file: string;
  /** All current 1-based line numbers with breakpoints in this file */
  lines: number[];
}

const UPDATE_DEBOUNCE_MS = 50;

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MonacoEditorModule
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss'
})
export class EditorComponent implements OnChanges, OnDestroy {
  // ── Properties ──────────────────────────────────────────────────────

  private readonly breakpointObserver = inject(BreakpointObserver);

  public editorOptions = {
    theme: 'vs',
    language: 'plaintext', // Language is dynamically set by updateLanguage()
    glyphMargin: true,
    automaticLayout: true,
    lineNumbers: 'on',
    minimap: { enabled: false },
    fontSize: 14, // dynamically managed by BreakpointObserver
    readOnly: true,
    readOnlyMessage: { value: '' },
    scrollBeyondLastLine: false,
    overviewRulerLanes: 3,
    hideCursorInOverviewRuler: true,
    fixedOverflowWidgets: true,
    padding: { bottom: 40, top: 0 },
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      verticalScrollbarSize: 14,
      horizontalScrollbarSize: 14,
      verticalSliderSize: 6,
      horizontalSliderSize: 6,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      useShadows: false,
      alwaysConsumeMouseWheel: false
    }
  };



  @Input() public filename: string | null = null;
  @Input() public code: string = '// Loading source code...';
  @Input() public activeLine: number | null = null;
  /** Incrementing trigger to force the editor to snap to the active line (e.g., on step or stack-frame click) */
  @Input() public revealTrigger: number = 0;

  /** Emits the full breakpoint list for a file whenever it changes */
  @Output() public readonly breakpointsChange = new EventEmitter<BreakpointChangeEvent>();

  private editorInstance: any;
  private breakpointIds: string[] = [];
  private activeLineDecorationIds: string[] = [];
  private readonly breakpoints: Map<string, Set<number>> = new Map();
  /** Verified breakpoints per file (line numbers confirmed by the DAP adapter) */
  private readonly verifiedBreakpoints: Map<string, Set<number>> = new Map();
  /** Stores Monaco view state (cursor, scroll, selection) per absolute file path */
  private readonly viewStates = new Map<string, any>();
  private readonly updateQueue$ = new Subject<void>();
  private lastRestoredFilename: string | null = null;
  private lastProcessedRevealTrigger: number = 0;

  // ── Dependencies ────────────────────────────────────────────────────

  private readonly zone = inject(NgZone);
  private readonly configService = inject(DapConfigService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Lifecycle ───────────────────────────────────────────────────────

  constructor() {
    this.updateQueue$.pipe(
      debounceTime(UPDATE_DEBOUNCE_MS),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.updateActiveLineDecoration();
      this.updateBreakpointDecorations();

      const hasFilenameChanged = this.filename !== this.lastRestoredFilename;
      const wasRevealRequested = this.revealTrigger > this.lastProcessedRevealTrigger;
      let stateRestored = false;

      // Restore view state if we switched to a new file and a state exists
      if (this.filename && hasFilenameChanged) {
        const savedState = this.viewStates.get(this.filename);
        if (this.editorInstance && savedState) {
          this.editorInstance.restoreViewState(savedState);
          stateRestored = true;
        }
        this.lastRestoredFilename = this.filename;
      }

      // Snap to active line only if:
      // 1. A reveal was explicitly requested (e.g., step or stack frame click)
      // 2. OR we switched to a file for the first time in this session (no saved state)
      if (this.activeLine && (wasRevealRequested || !stateRestored)) {
        this.scrollToLine(this.activeLine);
      }

      if (wasRevealRequested) {
        this.lastProcessedRevealTrigger = this.revealTrigger;
      }
    });

    // Dynamically update Monaco font size when entering/exiting Compact Mode
    this.breakpointObserver.observe(LAYOUT_COMPACT_MQ)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        const newSize = state.matches ? 12 : 14;
        this.editorOptions.fontSize = newSize;
        if (this.editorInstance) {
          this.editorInstance.updateOptions({ fontSize: newSize });
        }
      });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['filename'] && this.editorInstance) {
      // Save state of the previous file before switching
      const prevFile = changes['filename'].previousValue;
      if (prevFile && prevFile !== changes['filename'].currentValue) {
        this.viewStates.set(prevFile, this.editorInstance.saveViewState());
      }
      this.updateLanguage();
    }
    if ((changes['activeLine'] || changes['code'] || changes['filename'] || changes['revealTrigger']) && this.editorInstance) {
      this.updateQueue$.next();
    }
  }

  public ngOnDestroy(): void {
    this.updateQueue$.complete();
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Returns all breakpoints in the current session.
   */
  public getBreakpoints(): Map<string, Set<number>> {
    return this.breakpoints;
  }

  /**
   * Returns the current verified line numbers for a given file.
   * Used by the parent to surgically update a single breakpoint's verified state
   * without overwriting the entire verified set.
   * @param file Absolute file path
   * @returns A copy of the verified line numbers, or an empty array if none
   */
  public getVerifiedLines(file: string): number[] {
    const verifiedSet = this.verifiedBreakpoints.get(file);
    return verifiedSet ? Array.from(verifiedSet) : [];
  }

  /**
   * Updates the verified breakpoint set for a given file and refreshes decorations.
   * Called by the parent component after receiving a `setBreakpoints` response.
   * @param file Absolute file path
   * @param verifiedLines 1-based line numbers that the DAP adapter confirmed as verified
   */
  public setVerifiedBreakpoints(file: string, verifiedLines: number[]): void {
    if (verifiedLines.length === 0) {
      // Remove the entry entirely to avoid accumulating empty Sets over a long session
      this.verifiedBreakpoints.delete(file);
    } else {
      this.verifiedBreakpoints.set(file, new Set(verifiedLines));
    }
    // Only refresh decorations if this file is currently open
    if (this.filename === file) {
      this.updateBreakpointDecorations();
    }
  }

  /**
   * Initializes the Monaco editor instance and sets up event handlers.
   * @param editor The Monaco editor instance.
   */
  public onEditorInit(editor: any): void {
    this.editorInstance = editor;
    this.updateLanguage(); // Initialize correct language for the active file

    // Listen for mouse click on the glyph margin (breakpoint area)
    this.editorInstance.onMouseDown((e: any) => {
      const monaco = (window as any).monaco;
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        this.zone.run(() => {
          this.toggleBreakpoint(e.target.position.lineNumber);
        });
      }
    });

    // Trigger initial decoration update
    this.updateQueue$.next();
  }

  // ── Private Logic ───────────────────────────────────────────────────

  /**
   * Identifies the correct Monaco language ID based on the file extension
   */
  private getLanguageFromPath(path: string | null): string {
    if (!path) return 'plaintext';

    const monaco = (window as any).monaco;
    if (!monaco || !monaco.languages) return 'plaintext';

    const languages = monaco.languages.getLanguages();

    // Find a registered language that claims this file extension
    const match = languages.find((lang: any) =>
      lang.extensions && lang.extensions.some((ext: string) => path.toLowerCase().endsWith(ext.toLowerCase()))
    );

    return match ? match.id : 'plaintext';
  }

  /**
   * Applies the dynamically detected language to the current Monaco model
   */
  private updateLanguage(): void {
    if (!this.editorInstance || !this.filename) return;
    const monaco = (window as any).monaco;
    const model = this.editorInstance.getModel();
    if (model && monaco && monaco.editor) {
      monaco.editor.setModelLanguage(model, this.getLanguageFromPath(this.filename));
    }
  }

  /**
   * Toggles a breakpoint at the current Monaco editor cursor position.
   * Required for the F9 keyboard shortcut.
   */
  public toggleBreakpointAtCurrentPosition(): void {
    if (!this.editorInstance) return;
    const position = this.editorInstance.getPosition();
    if (position) {
      this.toggleBreakpoint(position.lineNumber);
    }
  }

  public toggleBreakpoint(lineNumber: number): void {
    if (!this.filename) return;

    let fileBps = this.breakpoints.get(this.filename);
    if (!fileBps) {
      fileBps = new Set<number>();
      this.breakpoints.set(this.filename, fileBps);
    }

    if (fileBps.has(lineNumber)) {
      fileBps.delete(lineNumber);
    } else {
      fileBps.add(lineNumber);
    }

    this.updateBreakpointDecorations();

    // Notify parent so it can sync with the DAP adapter (WI-13)
    this.breakpointsChange.emit({
      file: this.filename,
      lines: Array.from(fileBps)
    });
  }

  private updateActiveLineDecoration(): void {
    if (!this.editorInstance) return;

    const monaco = (window as any).monaco;
    const decorations: any[] = [];

    if (this.activeLine) {
      decorations.push({
        range: new monaco.Range(this.activeLine, 1, this.activeLine, 1),
        options: {
          isWholeLine: true,
          className: 'current-line-highlight',
          glyphMarginClassName: 'current-line-glyph'
        }
      });
    }

    this.activeLineDecorationIds = this.editorInstance.deltaDecorations(
      this.activeLineDecorationIds,
      decorations
    );
  }

  private updateBreakpointDecorations(): void {
    if (!this.editorInstance) return;

    const monaco = (window as any).monaco;
    const decorations: any[] = [];

    if (this.filename) {
      const fileBps = this.breakpoints.get(this.filename);
      const verifiedSet = this.verifiedBreakpoints.get(this.filename);
      if (fileBps) {
        fileBps.forEach((line) => {
          const isVerified = verifiedSet ? verifiedSet.has(line) : false;
          decorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: false,
              // Use different CSS class depending on verification state
              glyphMarginClassName: isVerified ? 'breakpoint-glyph' : 'breakpoint-glyph-unverified'
            }
          });
        });
      }
    }

    this.breakpointIds = this.editorInstance.deltaDecorations(
      this.breakpointIds,
      decorations
    );
  }

  private scrollToLine(lineNumber: number): void {
    if (!this.editorInstance) return;
    this.editorInstance.revealLineInCenter(lineNumber);
    this.editorInstance.setPosition({ lineNumber, column: 1 });
  }
}