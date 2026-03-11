import { Injectable, inject } from '@angular/core';

/**
 * 1. 狀態管理服務 (Service)
 * 負責在兩個頁面之間傳遞與暫存 GDB 設定參數
*/
@Injectable({
  providedIn: 'root'
})
export class GdbConfigService {
  private config = {
    executableFile: '',
    sourceFile: ''
  };

  setConfig(exec: string, src: string) {
    this.config.executableFile = exec;
    this.config.sourceFile = src;
    console.log('GDB 設定已儲存:', this.config);
  }

  getConfig() {
    return this.config;
  }
}
