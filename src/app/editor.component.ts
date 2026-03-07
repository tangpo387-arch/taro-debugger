import { Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms'; // 處理 [(ngModel)]
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

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
export class EditorComponent {
  editorOptions = {
    theme: 'vs-dark',
    language: 'cpp',
    glyphMargin: true,
    automaticLayout: true
  };

  code: string = '// Loading source code...'; // 編輯器顯示的內容
  private editorInstance: any;               // 儲存 Monaco 實例以便後續操作
  private breakpointIds: string[] = [];      // 追蹤當前的斷點 ID

  constructor(private zone: NgZone) {}
}