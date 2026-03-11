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

// 引入全域設定服務 (請確保路徑與您的專案結構一致)
import { GdbConfigService } from './gdb-config.service';

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
    MatIconModule
  ],
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class SetupComponent {
  /** 綁定至畫面的執行檔路徑 */
  public execPath: string = '';
  
  /** 綁定至畫面的原始碼目錄路徑 */
  public sourcePath: string = '';

  // 運用 Angular 的 inject() 函式注入所需之服務與路由物件
  private readonly router = inject(Router);
  private readonly configService = inject(GdbConfigService);

  /**
   * 處理「Connect & Debug」按鈕之點擊事件
   * 此方法將儲存使用者輸入之環境配置，並導航至核心偵錯視圖
   */
  public onConnect(): void {
    if (!this.execPath || !this.sourcePath) {
      console.warn('執行檔或原始碼路徑尚未填寫完整。');
      return;
    }

    // 1. 將設定參數委託給 GdbConfigService 進行全域暫存
    this.configService.setConfig(this.execPath, this.sourcePath);
    
    // 2. (預留擴充) 於此處可呼叫 Electron IPC API 以啟動底層 GDB 程序
    // window.electronAPI.startGdb(this.execPath);
    
    // 3. 透過 Angular Router 切換至偵錯主畫面
    this.router.navigate(['/debug']);
  }
}