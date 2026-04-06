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
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { DapConfigService } from './dap-config.service';
import { EnvironmentDetectService } from './environment-detect.service';

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
    FormsModule,
    MonacoEditorModule
  ],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnChanges, OnDestroy {
  // ── Properties ──────────────────────────────────────────────────────

  private readonly envDetect = inject(EnvironmentDetectService);

  public editorOptions = {
    theme: 'vs',
    language: 'cpp',
    glyphMargin: true,
    automaticLayout: true,
    lineNumbers: 'on',
    minimap: { enabled: false },
    fontSize: this.queryCssToken('--text-base', 14)
  };

  /**
   * Queries a CSS token from the body and converts rem/px to a numeric pixel size.
   * A fallback is required for three primary defensive programming reasons:
   * 1. SSR/Test Safety: The window/document objects may not exist in Node.js environments.
   * 2. Initialization Timing: Angular may instantiate this class before CSS is fully heavily parsed.
   * 3. Robustness: Prevents Editor core failure if the CSS token is ever typo'd or removed.
   */
  private queryCssToken(token: string, fallback: number): number {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.body).getPropertyValue(token).trim();
    if (!val) return fallback;
    if (val.endsWith('rem')) {
      return parseFloat(val) * 16; // 1rem = 16px
    }
    return parseFloat(val) || fallback;
  }

  @Input() public filename: string | null = null;
  @Input() public code: string = '// Loading source code...';
  @Input() public activeLine: number | null = null;

  /** Emits the full breakpoint list for a file whenever it changes */
  @Output() public readonly breakpointsChange = new EventEmitter<BreakpointChangeEvent>();

  private editorInstance: any;
  private breakpointIds: string[] = [];
  private activeLineDecorationIds: string[] = [];
  private readonly breakpoints: Map<string, Set<number>> = new Map();
  /** Verified breakpoints per file (line numbers confirmed by the DAP adapter) */
  private readonly verifiedBreakpoints: Map<string, Set<number>> = new Map();
  private readonly updateQueue$ = new Subject<void>();

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
      if (this.activeLine) {
        this.scrollToLine(this.activeLine);
      }
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if ((changes['activeLine'] || changes['code'] || changes['filename']) && this.editorInstance) {
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

  private toggleBreakpoint(lineNumber: number): void {
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