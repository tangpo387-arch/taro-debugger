import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ViewChildren, QueryList } from '@angular/core';

// 引入 Angular Material 相關模組
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

// 引入子元件與全域設定服務
import { EditorComponent } from './editor.component';
import { ErrorDialog, ErrorDialogData } from './error-dialog/error-dialog';
import { DapConfigService, DapConfig } from './dap-config.service';
import { DapSessionService } from './dap-session.service';
import { DapTransportService } from './dap-transport.service';
import { WebSocketTransportService } from './websocket-transport.service';
import { DapEvent } from './dap.types';

@Component({
  selector: 'app-debugger',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSidenavModule,
    MatListModule,
    MatTabsModule,
    ScrollingModule,
    MatSnackBarModule,
    MatDialogModule,
    FormsModule,
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
  private readonly cdr = inject(ChangeDetectorRef);

  /** 綁定 DAP 連線狀態 */
  public readonly connectionStatus$: Observable<boolean> = this.dapSession.connectionStatus$;

  private eventSubscription?: Subscription;

  // ViewChildren for auto-scrolling
  @ViewChildren(CdkVirtualScrollViewport) viewports!: QueryList<CdkVirtualScrollViewport>;

  /** 儲存當前 DAP 之完整組態，供 HTML 模板綁定顯示 */
  public currentConfig: DapConfig = {
    serverAddress: '',
    launchMode: 'launch',
    executablePath: '',
    sourcePath: '',
    programArgs: ''
  };

  /** 當前執行狀態 */
  public executionState: 'starting' | 'running' | 'stopped' | 'terminated' = 'starting';

  /** DAP 輸出紀錄 */
  public dapLogs: LogEntry[] = [];

  /** Program 輸出紀錄 */
  public programLogs: LogEntry[] = [];

  /** 當前輸入的 evaluate 查詢語句 */
  public evaluateExpression: string = '';

  /**
   * 於元件初始化時執行
   * 負責向 DapConfigService 獲取最新的配置資訊
   */
  public async ngOnInit(): Promise<void> {
    this.currentConfig = this.configService.getConfig();

    this.appendDapLog("Start debugging session...", 'console');

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
      this.appendDapLog("Initializing DAP Session...", 'console');

      this.eventSubscription = this.dapSession.onEvent().subscribe((event) => {
        this.handleDapEvent(event);
      });

      await this.dapSession.initializeSession();

      this.appendDapLog(`Launching in ${this.currentConfig.launchMode} mode...`, 'console');
      await this.dapSession.launchOrAttach();

      // 注意：configurationDone 移至 initialized 事件處理
    } catch (error: any) {
      // 1. 清理有問題的會話
      this.dapSession.disconnect();

      const msg = error?.message || '不明錯誤';
      this.appendDapLog(`[Error] Session failed: ${msg}`, 'stderr');

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
          this.appendDapLog("Retrying session...", 'console');
          this.startSession(); // 重新嘗試
        } else {
          // 'goback' 或其他關閉方式
          this.goBack();
        }
      });
    }
  }

  private handleDapEvent(event: DapEvent): void {
    const skipLogs = ['output', 'breakpoint'];
    if (!skipLogs.includes(event.event)) {
      this.appendDapLog(`[Event] ${event.event}`, 'console');
    }

    switch (event.event) {
      case 'initialized':
        this.appendDapLog("Configuration Done.", 'console');
        this.dapSession.configurationDone().catch(err => {
          this.appendDapLog(`[Error] configurationDone failed: ${err}`, 'stderr');
        });
        break;
      case 'stopped':
        this.executionState = 'stopped';
        // TODO: 觸發 stackTrace / scopes / variables 查詢
        break;
      case 'continued':
        this.executionState = 'running';
        break;
      case 'terminated':
      case 'exited':
        this.executionState = 'terminated';
        this.snackBar.open('偵錯會話已終止', 'OK', { duration: 3000 });
        break;
      case 'output':
        if (event.body) {
          const body = event.body as any;
          const outMsg = body.output;
          const category = body.category || 'console'; // 'console', 'stdout', 'stderr', 'telemetry'
          if (category === 'stdout' || category === 'stderr') {
            this.appendProgramLog(outMsg, category);
          } else {
            this.appendDapLog(outMsg, category);
          }
        }
        break;
      case 'breakpoint':
        // TODO: 更新 UI 斷點狀態
        break;
    }
  }

  /** 發送 evaluate 查詢請求 */
  public async evaluateCommand(): Promise<void> {
    if (!this.evaluateExpression.trim() || this.executionState !== 'stopped') {
      return;
    }

    const expr = this.evaluateExpression;
    this.evaluateExpression = ''; // clear input
    this.appendDapLog(`> ${expr}`, 'console');

    try {
      const response = await this.dapSession.sendRequest('evaluate', {
        expression: expr,
        context: 'repl'
      });

      if (response.success && response.body) {
        this.appendDapLog(response.body.result, 'stdout');
      } else {
        this.appendDapLog(response.message || 'Evaluate failed', 'stderr');
      }
    } catch (e: any) {
      this.appendDapLog(`[Error] ${e.message}`, 'stderr');
    }
  }

  private appendDapLog(message: string, category: string = 'console'): void {
    if (!message) return;
    const cleanMsg = message.endsWith('\n') ? message.slice(0, -1) : message;

    // 不可變更新：建立新引用以觸發變更檢測
    this.dapLogs = [...this.dapLogs, {
      timestamp: new Date(),
      message: cleanMsg,
      category
    }];
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private appendProgramLog(message: string, category: string = 'console'): void {
    if (!message) return;
    const cleanMsg = message.endsWith('\n') ? message.slice(0, -1) : message;

    // 不可變更新
    this.programLogs = [...this.programLogs, {
      timestamp: new Date(),
      message: cleanMsg,
      category
    }];
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    // 強制下一幀滾動到底部
    setTimeout(() => {
      this.viewports.forEach(viewport => {
        viewport.scrollToIndex(viewport.getDataLength(), 'smooth');
      });
    }, 50);
  }

  public trackByFn(index: number, item: LogEntry): string {
    return item.timestamp.getTime() + item.message;
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

export interface LogEntry {
  timestamp: Date;
  message: string;
  category: string;
}