import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <!--
      應用程式的根路由容器
      根據當前網址，這裡將會動態掛載：
      1. SetupComponent (路徑: /setup)
      2. DebuggerComponent (路徑: /debug)
    -->
    <router-outlet></router-outlet>
  `,
  styles: [`
    /* 確保根元件佔滿整個視窗空間，做為最底層的畫布 */
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: #f9fafb; /* 預設淺色背景，可視需求調整 */
    }
  `]
})
export class App {
  // 此為應用的核心進入點。
  // 在目前的架構下，狀態管理與介面邏輯由各別的頁面元件與 Service 負責，
  // 因此這裡保持簡潔即可。
}
