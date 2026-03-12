import { Component, inject, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms'; // 處理 [(ngModel)]
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
export class EditorComponent {
  editorOptions = {
    theme: 'vs',
    language: 'cpp',
    glyphMargin: true,
    automaticLayout: true,
    fontSize: 14,
    lineNumbers: 'on',
    minimap: { enabled: false }
  };

  code: string = '// Loading source code...'; // 編輯器顯示的內容
  private editorInstance: any;               // 儲存 Monaco 實例以便後續操作
  private breakpointIds: string[] = [];      // 追蹤當前的斷點 ID
  private readonly configService = inject(DapConfigService);

  constructor(private zone: NgZone) {
    // 可以在這裡存取設定
    console.log('Editor initialized with config:', this.configService.getConfig());
  }
}