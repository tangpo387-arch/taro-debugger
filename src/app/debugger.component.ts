import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// 引入 Angular Material 相關模組
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { ScrollingModule } from '@angular/cdk/scrolling';

// 引入子元件與全域設定服務
import { EditorComponent } from './editor.component';
import { DapConfigService } from './dap-config.service';

@Component({
  selector: 'app-debugger',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatTabsModule,
    ScrollingModule,
    EditorComponent,
  ],
  templateUrl: './debugger.component.html',
  styleUrls: ['./debugger.component.scss']
})
export class DebuggerComponent implements OnInit {
  // 注入依賴服務
  private readonly configService = inject(DapConfigService);
  private readonly router = inject(Router);

  /** 儲存當前 DAP 之配置狀態，供 HTML 模板綁定顯示 */
  public currentConfig: { executableFile: string; sourceFile: string } = {
    executableFile: '',
    sourceFile: ''
  };

  /** 模擬的 DAP 輸出紀錄 */
  public dapLogs: string[] = [];

  /** 模擬的 Program 輸出紀錄 */
  public programLogs: string[] = [];

  /**
   * 於元件初始化時執行
   * 負責向 DapConfigService 獲取最新的配置資訊
   */
  public ngOnInit(): void {
    this.currentConfig = this.configService.getConfig();

    this.dapLogs.push("Start debugging session...");

    // 防呆機制：若未獲取到執行檔路徑，自動導向回設定頁面
    if (!this.currentConfig.executableFile) {
      console.warn('偵測到未完整的設定參數，系統將自動導回設定頁面。');
      this.router.navigate(['/setup']);
    }
  }

  /**
   * 處理「重新設定」按鈕之點擊事件
   * 此方法將中斷當前偵錯作業，並導航回設定視圖
   */
  public goBack(): void {
    // (預留擴充) 於此處可呼叫 Electron IPC API 以終止底層 DAP 程序
    // window.electronAPI.stopDap();

    this.router.navigate(['/setup']);
  }
}