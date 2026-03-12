import { Injectable, inject } from '@angular/core';

/**
 * 1. 狀態管理服務 (Service)
 * 負責在兩個頁面之間傳遞與暫存 DAP 設定參數
*/
@Injectable({
  providedIn: 'root'
})
export class DapConfigService {
  private config = {
    executableFile: '',
    sourceFile: ''
  };

  setConfig(exec: string, src: string) {
    this.config.executableFile = exec;
    this.config.sourceFile = src;
    console.log('DAP 設定已儲存:', this.config);
  }

  getConfig() {
    return this.config;
  }
}
