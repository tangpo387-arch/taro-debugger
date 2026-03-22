import { Component, Input, inject, NgZone, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { FormsModule } from '@angular/forms'; // Handles [(ngModel)]
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { DapConfigService } from './dap-config.service';

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
  editorOptions = {
    theme: 'vs',
    language: 'cpp',
    glyphMargin: true,
    automaticLayout: true,
    fontSize: 14,
    lineNumbers: 'on',
    minimap: { enabled: false }
  };

  @Input() code: string = '// Loading source code...'; // Content displayed in the editor
  @Input() activeLine: number | null = null;
  private editorInstance: any;               // Stores Monaco instance for future operations
  private breakpointIds: string[] = [];      // Track current breakpoint IDs
  private activeLineDecorationIds: string[] = []; // Track highlight IDs for the current execution line
  private readonly configService = inject(DapConfigService);
  private updateQueue$ = new Subject<void>();

  constructor(private zone: NgZone) {
    // Access configuration as needed
    this.updateQueue$.pipe(debounceTime(50)).subscribe(() => {
      this.updateActiveLineDecoration();
      if (this.activeLine) {
        this.scrollToLine(this.activeLine);
      }
    });
  }

  onEditorInit(editor: any) {
    this.editorInstance = editor;
    if (this.activeLine) {
      this.scrollToLine(this.activeLine);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['activeLine'] || changes['code']) && this.editorInstance) {
      this.updateQueue$.next();
    }
  }

  ngOnDestroy() {
    this.updateQueue$.complete();
  }

  private updateActiveLineDecoration() {
    if (!this.editorInstance) return;

    const decorations: any[] = [];
    if (this.activeLine) {
      decorations.push({
        range: new (window as any).monaco.Range(this.activeLine, 1, this.activeLine, 1),
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

  private scrollToLine(line: number) {
    this.editorInstance.revealLineInCenter(line);
    this.editorInstance.setPosition({ lineNumber: line, column: 1 });
  }
}