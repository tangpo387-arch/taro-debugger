import { 
  Component, 
  Input, 
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

  public editorOptions = {
    theme: 'vs',
    language: 'cpp',
    glyphMargin: true,
    automaticLayout: true,
    fontSize: 14,
    lineNumbers: 'on',
    minimap: { enabled: false }
  };

  @Input() public filename: string | null = null;
  @Input() public code: string = '// Loading source code...';
  @Input() public activeLine: number | null = null;

  private editorInstance: any;
  private breakpointIds: string[] = [];
  private activeLineDecorationIds: string[] = [];
  private readonly breakpoints: Map<string, Set<number>> = new Map();
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
      if (fileBps) {
        fileBps.forEach((line) => {
          decorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: false,
              glyphMarginClassName: 'breakpoint-glyph'
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