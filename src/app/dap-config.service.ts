import { Injectable } from '@angular/core';

/**
 * 完整的 DAP 連線組態介面
 * 涵蓋伺服器位址、啟動模式、路徑及程式引數
 */
/** 支援的傳輸層類型 */
export type TransportType = 'websocket' | 'serial' | 'tcp';

export interface DapConfig {
  /** DAP Server 連線位址，格式為 host:port（例如 localhost:4711） */
  serverAddress: string;

  /** 傳輸層類型：websocket、serial 或 tcp */
  transportType: TransportType;

  /** 啟動模式：launch 由偵錯器啟動程序，attach 附加至已執行程序 */
  launchMode: 'launch' | 'attach';

  /** 被偵錯程式的可執行檔路徑 */
  executablePath: string;

  /** 原始碼根目錄路徑 */
  sourcePath: string;

  /** 傳遞給被偵錯程式的命令列引數（可選） */
  programArgs: string;
}

/**
 * DapConfigService
 *
 * 狀態管理服務，負責在設定頁面（SetupComponent）與
 * 偵錯頁面（DebuggerComponent）之間傳遞完整的 DAP 連線組態。
 */
@Injectable({
  providedIn: 'root'
})
export class DapConfigService {
  private config: DapConfig = {
    serverAddress: '',
    transportType: 'websocket',
    launchMode: 'launch',
    executablePath: '',
    sourcePath: '',
    programArgs: ''
  };

  /**
   * 儲存完整的 DAP 組態。
   * @param config 完整的 DapConfig 物件
   */
  setConfig(config: DapConfig): void {
    this.config = { ...config };
    console.log('DAP 設定已儲存:', this.config);
  }

  /**
   * 取得當前的 DAP 組態（回傳副本，防止外部直接修改）。
   */
  getConfig(): DapConfig {
    return { ...this.config };
  }
}
