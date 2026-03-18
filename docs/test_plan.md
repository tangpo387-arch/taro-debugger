# DAP 偵錯器前端 — 自動化測試計畫 (Test Plan)

> [!NOTE]
> 本文件旨在說明 DAP 偵錯器前端 (DAP Frontend) 的自動化測試 (Auto-Test) 架構、工具選型與具體測試項目，以確保重構與新功能開發時的系統穩定性。

---

## 1. 測試策略與架構 (Test Strategy & Architecture)

專案採用**測試金字塔 (Test Pyramid)** 原則，將大部分測試集中於執行速度快、穩定性高的單元測試與整合測試，並輔以少量的端到端 (E2E) 測試以確保整體流程之正確性。

### 1.1 測試工具鏈 (Toolchain)

*   **單元與整合測試 (Unit & Integration Tests)**：採用 **Vitest** + **jsdom**。相較於傳統 Angular 的 Karma + Jasmine，Vitest 具有更快的執行速度配置，適合本專案高頻率的抽象層次邏輯驗證。
*   **端到端測試 (E2E Tests)**：建議採用 **Playwright**。因其對於 WebSocket 通訊攔截與 Electron 桌面應用程式測試具有原生且強大的支援。
*   **斷言與 Mocking**：使用 Vitest 內建的 `expect` 與 `vi.mock()` / `vi.spyOn()` 進行隔離測試。

---

## 2. 自動化測試項目規劃 (Test Items / Scope)

測試範圍依據 `work_items.md` 與 `specification.md` 分為單元、整合及 E2E 三個層級。

### 2.1 單元測試 (Unit Tests)

針對系統單一組件、Service 或 Utility 函數進行完全隔離的測試。這部分著重於資料轉換、狀態機與錯誤邏輯判定。

#### A. 核心服務 (Core Services)
*   **`DapConfigService`**
    *   驗證狀態組態的存取：`setConfig()` 與 `getConfig()` 是否能正確存儲與回傳完整的 `DapConfig` 資料。
*   **`DapSessionService` (DAP 會話生命週期)**
    *   **Sequence ID 管理**：驗證發出 request 時 `seq` 是否正確遞增。
    *   **Promise Mapping**：驗證 `sendRequest` 產生的 Promise 在收到 response 時能正確 resolve 或 reject。
    *   **Timeout 機制**：模擬伺服器無回應，驗證 `sendRequest` 於設定時間後是否觸發 timeout 錯誤。
*   **`WebSocketTransportService` (DAP 傳輸層)**
    *   **Header 解析驗證**：傳入合法的 `Content-Length: ...\r\n\r\n` 格式，確保封包能被正確分割並觸發 message 事件。
    *   **黏包/半包處理**：模擬 TCP 傳輸時的碎化封包（分多次接收），驗證 Buffer 拼接邏輯是否能正確拼出完整 JSON。
    *   **防呆與錯誤隔離 (Fail-Fast)**：送入錯誤格式的封包（例如缺失 Header、第一個字元不為 `C` 或非 Blob 型態資料），驗證服務是否永久中斷 `Subject` 並拒絕後續訊息。

#### B. UI 組件 (UI Components)
*   **`SetupComponent`**
    *   **表單驗證 (Form Validation)**：未填寫必填欄位 (DAP Server 位址、執行檔路徑) 時，表單應為 invalid；連線位址格式錯誤時，應觸發相應的 validation error。
    *   **狀態切換**：切換 Launch / Attach 模式時，按鈕文字與可見欄位應正確變動。
*   **`DebuggerComponent`**
    *   確保組件初始化與銷毀時，能正確調用 Session Service 的 `initialize` 與 `disconnect`。

---

### 2.2 整合測試 (Integration Tests)

測試多個 Service 或 Component 之間的互動與資料流，通常需 Mock 最外層的 I/O (例如 WebSocket)。

*   **DAP 啟動流程整合 (Launch Flow Integration)**
    *   從 `SetupComponent` 表單提交開始 → 寫入 `DapConfigService` → 驅動 `DebuggerComponent` 初始化 → 觸發 `DapSessionService` 的 `initialize()` 與 `launch()` 序列。驗證各環節的資料傳遞無誤。
*   **事件驅動狀態同步 (Event-Driven State Sync)**
    *   模擬 WebSocket 收到 `stopped` 事件 → 驗證 `DapSessionService` 是否送出 `stackTrace` 等請求 → 驗證 UI 狀態管理是否切換至「暫停」狀態。
    *   模擬 WebSocket 收到 `output` 事件 → 驗證主控台 Log 陣列是否正確增加新紀錄，且自動分類 (category)。
*   **斷點與編輯器同步 (Breakpoint Sync)**
    *   模擬 Monaco Editor 點擊 Glyph Margin 新增斷點 → 驗證系統是否透過 `DapSessionService` 送出對應檔案的 `setBreakpoints` 請求。

---

### 2.3 端到端測試 (End-to-End Tests)

從使用者視角啟動完整應用程式（瀏覽器模式）。為避免依賴真實的 C/C++ 編譯環境，採用 Mock DAP Server 方式進行。

*   **正常偵錯路徑 (Happy Path)**
    1.  進入 `/setup` 頁面，填寫 Mock Server 位址與參數。
    2.  點擊 Launch 進入 `/debug` 頁面，顯示綠燈 (連線狀態)。
    3.  Mock Server 發送 `stopped` 事件，UI 左側載入檔案樹（如適用）、右側呼叫堆疊更新、按鈕層 Continue 解鎖。
    4.  點擊 Continue 按鈕，UI 狀態恢復為 Running。
*   **異常與超時路徑 (Error Path)**
    *   輸入無法連線的位址，驗證 UI 顯示 Timeout 錯誤對話框（或 Error SnackBar）。
    *   在偵錯途中關閉 Mock Server 連線，驗證狀態列轉為灰/紅燈，且跳出斷線提示。

---

## 3. 測試環境與 CI/CD 整合 (CI/CD Integration)

1.  **本機執行指令**
    *   單元/整合測試：`npm run test` (背後執行 Vitest)
    *   監視模式：`npx vitest watch`
2.  **Pull Request 驗證**
    *   每一次提交至主幹的 PR，皆需在 CI Server (例如 GitHub Actions) 上無介面 (Headless) 執行 `npm run test`，所有測試通過後始可合併。
3.  **覆蓋率要求 (Coverage Requirements)**
    *   針對核心商業邏輯 (如 `DapSessionService` 與 `WebSocketTransportService`) 的單元測試覆蓋率 (Line/Branch Coverage) 目標應達 85% 以上，以確保最脆弱的非同步資料流受保護。

---

## 4. 測試撰寫規範 (Best Practices)

1.  **3A 原則 (Arrange-Act-Assert)**
    單元測試的撰寫應清楚劃分：準備資料 (Arrange) -> 執行操作 (Act) -> 驗證結果 (Assert)。
2.  **非同步處理**
    在驗證 Observable 與 Promise 時，應妥善運用 Vitest 的 `async/await` 或 RxJS 的測試輔助函數，避免假陽性 (False Positive) 的 `expect` 漏測。
3.  **依賴注入 (Dependency Injection) 的 Mocking**
    測試 Angular 服務與元件時，使用 `TestBed` 提供依賴，對於不屬於測試主體的依賴 (如 `HttpClient` 或真實的 `WebSocket`) 必須注入其 Mock 版本。
