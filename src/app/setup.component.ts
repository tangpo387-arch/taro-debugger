import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// 引入 Angular Material 相關模組
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';

// 引入全域設定服務
import { DapConfigService } from './dap-config.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatDividerModule,
  ],
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class SetupComponent {
  /** DAP Server 連線位址（例如 localhost:4711） */
  public serverAddress: string = 'localhost:4711';

  /** 啟動模式 */
  public launchMode: 'launch' | 'attach' = 'launch';

  /** 被偵錯程式的可執行檔路徑（executablePath） */
  public execPath: string = '';

  /** 原始碼根目錄路徑（sourcePath） */
  public sourcePath: string = '';

  /** 傳遞給被偵錯程式的命令列引數（選填） */
  public programArgs: string = '';

  // 運用 Angular 的 inject() 函式注入所需之服務與路由物件
  private readonly router = inject(Router);
  private readonly configService = inject(DapConfigService);

  /**
   * 根據目前的 launchMode 回傳動態按鈕文字
   */
  get connectButtonLabel(): string {
    return this.launchMode === 'launch' ? 'Launch & Debug' : 'Attach & Debug';
  }

  /**
   * 根據目前的 launchMode 回傳動態按鈕圖示
   */
  get connectButtonIcon(): string {
    return this.launchMode === 'launch' ? 'play_arrow' : 'link';
  }

  /**
   * 表單的基本有效性檢查（後續 WI-03 會改為 Reactive Forms + Validators）
   */
  get isFormValid(): boolean {
    const hasServer = !!this.serverAddress.trim();
    const hasExec = this.launchMode === 'launch' ? !!this.execPath.trim() : true;
    return hasServer && hasExec;
  }

  /**
   * 處理「Connect & Debug」按鈕之點擊事件
   * 此方法將儲存使用者輸入之環境配置，並導航至核心偵錯視圖
   */
  public onConnect(): void {
    if (!this.isFormValid) {
      console.warn('必填欄位尚未填寫完整。');
      return;
    }

    // 1. 將設定參數委託給 DapConfigService 進行全域暫存
    this.configService.setConfig({
      serverAddress: this.serverAddress,
      launchMode: this.launchMode,
      executablePath: this.execPath,
      sourcePath: this.sourcePath,
      programArgs: this.programArgs
    });

    // 2. (預留擴充) 於此處可呼叫 Electron IPC API 以啟動底層 DAP 程序
    // window.electronAPI.startDap(this.execPath);

    // 3. 透過 Angular Router 切換至偵錯主畫面
    this.router.navigate(['/debug']);
  }
}