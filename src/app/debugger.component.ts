import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// 引入 Angular Material 相關模組
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

// 引入子元件與全域設定服務
import { EditorComponent } from './editor.component';
import { ErrorDialog, ErrorDialogData } from './error-dialog/error-dialog';
import { DapConfigService, DapConfig } from './dap-config.service';
import { DapSessionService } from './dap-session.service';
import { DapTransportService } from './dap-transport.service';
import { WebSocketTransportService } from './websocket-transport.service';

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
    MatSnackBarModule,
    MatDialogModule,
    EditorComponent,
  ],
  providers: [
    DapSessionService,
    { provide: DapTransportService, useClass: WebSocketTransportService }
  ],
  templateUrl: './debugger.component.html',
  styleUrls: ['./debugger.component.scss']
})
export class DebuggerComponent implements OnInit, OnDestroy {
  // 注入依賴服務
  private readonly configService = inject(DapConfigService);
  private readonly router = inject(Router);
  private readonly dapSession = inject(DapSessionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  private eventSubscription?: Subscription;

  /** 儲存當前 DAP 之完整組態，供 HTML 模板綁定顯示 */
  public currentConfig: DapConfig = {
    serverAddress: '',
    launchMode: 'launch',
    executablePath: '',
    sourcePath: '',
    programArgs: ''
  };

  /** 模擬的 DAP 輸出紀錄 */
  public dapLogs: string[] = [];

  /** 模擬的 Program 輸出紀錄 */
  public programLogs: string[] = [];

  /**
   * 於元件初始化時執行
   * 負責向 DapConfigService 獲取最新的配置資訊
   */
  public async ngOnInit(): Promise<void> {
    this.currentConfig = this.configService.getConfig();

    this.dapLogs.push("Start debugging session...");

    // 防呆機制：若未獲取到執行檔路徑，自動導向回設定頁面
    if (!this.currentConfig.executablePath) {
      console.warn('偵測到未完整的設定參數，系統將自動導回設定頁面。');
      this.snackBar.open('偵測到未完整的設定參數，返回設定頁面。', 'OK', { duration: 3000 });
      this.router.navigate(['/setup']);
      return;
    }

    await this.startSession();
  }

  /**
   * 啟動 DAP Session，包含錯誤捕獲與重試視窗
   */
  private async startSession(): Promise<void> {
    try {
      this.dapLogs.push("Initializing DAP Session...");
      await this.dapSession.initializeSession();

      this.dapLogs.push(`Launching in ${this.currentConfig.launchMode} mode...`);
      await this.dapSession.launchOrAttach();

      this.dapLogs.push("Configuration Done.");
      await this.dapSession.configurationDone();

      this.eventSubscription = this.dapSession.onEvent().subscribe((event) => {
        this.dapLogs.push(`[Event] ${event.event}`);
      });
    } catch (error: any) {
      // 1. 清理有問題的會話
      this.dapSession.disconnect();

      const msg = error?.message || '不明錯誤';
      this.dapLogs.push(`[Error] Session failed: ${msg}`);
      
      // 2. 顯示對話框
      const dialogRef = this.dialog.open(ErrorDialog, {
        width: '400px',
        disableClose: true, // 強制使用者選擇
        data: {
          title: 'DAP 握手失敗',
          message: `無法建立 DAP 連線或會話：${msg}`
        } as ErrorDialogData
      });

      // 3. 處理對話框結果
      dialogRef.afterClosed().subscribe((result: string) => {
        if (result === 'retry') {
          this.dapLogs.push("Retrying session...");
          this.startSession(); // 重新嘗試
        } else {
          // 'goback' 或其他關閉方式
          this.goBack();
        }
      });
    }
  }

  public ngOnDestroy(): void {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
    this.dapSession.disconnect();
  }

  /**
   * 處理「重新設定」按鈕之點擊事件
   * 此方法將中斷當前偵錯作業，並導航回設定視圖
   */
  public goBack(): void {
    // 中斷連線與會話
    this.dapSession.disconnect();

    this.router.navigate(['/setup']);
  }
}