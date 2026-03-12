import { Routes } from '@angular/router';

// 匯入我們先前建立的兩個頁面元件
// 【注意】：請根據您實際的檔案存放目錄結構，調整這裡的路徑
import { SetupComponent } from './setup.component';
import { DebuggerComponent } from './debugger.component';

export const routes: Routes = [
  {
    // 當網址為 '/setup' 時，載入設定頁面
    path: 'setup',
    component: SetupComponent,
    title: '設定環境 - TaroDAP' // 這裡可以順便設定瀏覽器分頁標題
  },
  {
    // 當網址為 '/debug' 時，載入核心偵錯主畫面
    path: 'debug',
    component: DebuggerComponent,
    title: '偵錯主畫面 - TaroDAP'
  },
  {
    // 當網址為空（即根目錄）時，自動重新導向至設定頁面
    path: '',
    redirectTo: '/setup',
    pathMatch: 'full' // 確保只有在路徑完全為空時才觸發導向
  },
  {
    // 萬用字元路由 (Catch-all)：
    // 如果使用者輸入了不存在的網址，自動導向回設定頁面
    path: '**',
    redirectTo: '/setup'
  }
];
