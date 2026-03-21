import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

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

/**
 * 自訂驗證器：驗證 DAP Server 連線位址格式（host:port）
 * 允許的格式範例：localhost:4711、192.168.1.1:1234、my-server.local:9090
 */
function serverAddressValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string)?.trim();
  if (!value) return null; // 讓 required 驗證器處理空值
  // host 可包含字母、數字、連字號、點；port 為 1~5 位數字
  const pattern = /^[a-zA-Z0-9._-]+:\d{1,5}$/;
  return pattern.test(value) ? null : { invalidFormat: true };
}

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
export class SetupComponent implements OnInit, OnDestroy {

  /**
   * 主表單群組，使用 Reactive Forms 管理所有欄位狀態與驗證。
   * nonNullable: true 確保 getRawValue() 回傳型別不含 null。
   */
  readonly form = new FormGroup({
    serverAddress: new FormControl('localhost:4711', {
      nonNullable: true,
      validators: [Validators.required, serverAddressValidator]
    }),
    launchMode: new FormControl<'launch' | 'attach'>('launch', {
      nonNullable: true,
      validators: Validators.required
    }),
    executablePath: new FormControl('', {
      nonNullable: true,
      validators: Validators.required
    }),
    sourcePath: new FormControl('', { nonNullable: true }),
    programArgs: new FormControl('', { nonNullable: true })
  });

  private readonly router = inject(Router);
  private readonly configService = inject(DapConfigService);
  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    // 監聽 launchMode 切換，動態調整 executablePath 的必填驗證器
    this.subscriptions.add(
      this.form.controls.launchMode.valueChanges.subscribe(mode => {
        const execCtrl = this.form.controls.executablePath;
        if (mode === 'launch') {
          execCtrl.setValidators(Validators.required);
        } else {
          execCtrl.clearValidators();
          execCtrl.setValue(''); // 切換至 Attach 時清除路徑值
        }
        execCtrl.updateValueAndValidity();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ── 便捷 Getter：供 Template 使用 ──────────────────────────────────

  /** 目前選擇的啟動模式 */
  get launchMode(): 'launch' | 'attach' {
    return this.form.controls.launchMode.value;
  }

  /** 根據目前的 launchMode 回傳動態按鈕文字 */
  get connectButtonLabel(): string {
    return this.launchMode === 'launch' ? 'Launch & Debug' : 'Attach & Debug';
  }

  /** 根據目前的 launchMode 回傳動態按鈕圖示 */
  get connectButtonIcon(): string {
    return this.launchMode === 'launch' ? 'play_arrow' : 'link';
  }

  // ── 事件處理器 ───────────────────────────────────────────────────────

  /**
   * 處理連線按鈕的點擊事件。
   * 若驗證失敗，標記所有控制項為「已接觸」以觸發行內錯誤訊息顯示。
   */
  public onConnect(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { serverAddress, launchMode, executablePath, sourcePath, programArgs } =
      this.form.getRawValue();

    // 1. 將設定參數委託給 DapConfigService 進行全域暫存
    this.configService.setConfig({
      serverAddress,
      transportType: 'websocket', // TODO: 未來由 UI 選擇
      launchMode,
      executablePath,
      sourcePath,
      programArgs
    });

    // 2. (預留擴充) 於此處可呼叫 Electron IPC API 以啟動底層 DAP 程序
    // window.electronAPI.startDap(executablePath);

    // 3. 透過 Angular Router 切換至偵錯主畫面
    this.router.navigate(['/debug']);
  }
}