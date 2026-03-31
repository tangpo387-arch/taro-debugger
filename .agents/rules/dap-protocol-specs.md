---
trigger: always_on
glob: "src/app/{dap-session.service,dap-transport.service,websocket-transport.service,transport.factory}.ts"
description: 確保所有 DAP 協定實作與會話邏輯符合專案特定的啟動序列與架構約束。
---

# DAP 協定實作規範 (Agent 專用規則)

本文件定義 AI Agent 在修改 DAP 相關 Service 時必須遵守的強制性規則，以防止 Race Condition、Deadlock 或是違反分層架構的代碼生成。

> [!NOTE]
> 關於協議設計的詳細原因與 FAQ，請參考：[docs/dap-integration-faq.md](../../docs/dap-integration-faq.md)
> 關於架構分層細節，請參考：[docs/architecture.md](../../docs/architecture.md)

---

## 1. 初始化順序約束 (Sequence Enforcement)

修改 `DapSessionService.startSession()` 或相關啟動邏輯時，必須嚴格遵守以下時序：

*   **R1: `initialized` 事件優先**
    *   在接收到 `initialized` **Event** 之前，禁止發送 `setBreakpoints` 或 `configurationDone` Request。
    *   **Adapter 行為差異（兩者皆符合 DAP Spec）**：
        *   `gdb -i=dap`：在 `initialize` Response 回傳後**立即**發送 `initialized` Event（不需等待 `launch`）。
        *   `lldb-dap`：在收到 `launch`/`attach` Request **之後**才發送 `initialized` Event。
    *   **通用相容實作（強制）**：Client 必須在 `initialize` Response 完成後，立刻以 **fire-and-forget** 方式送出 `launch`/`attach` Request，**然後** await `initialized` Event。絕不可在 await `initialized` 之後才送出 `launch`，否則對 `lldb-dap` 將造成雙向死結 (Deadlock)。
*   **R2: `launch/attach` 請求必須在 `configurationDone` 之前** 
    *   `configurationDone` 的 **Request** 必須在 `launch` 或 `attach` **Request** 送出之後才能發送。
*   **R3: 非同步解鎖 (Deadlock Prevention)**
    *   發送 `launch/attach` Request 時，必須採用 **fire-and-forget** 模式（即：先送出 request，但不立即在該處 await response）。
    *   必須先 await `configurationDone` 的 Response，之後才去 await `launch/attach` 的 Response。
*   **R4: Client 端事件處理順序**
    *   Client 端必須先完成 `initialize` Request/Response 的交換（取得 Capabilities）之後，才能處理 `initialized` Event。
    *   無論 `initialized` Event 在底層傳輸層何時抵達（早於或晚於 `launch`），Client 端的 **事件處理邏輯** 均必須在 `initialize` Response 處理完畢後才解除封鎖。

## 2. 執行狀態管理 (State Machine)

*   **R5: 狀態轉移唯一性與規範**
    *   `ExecutionState` 必須由 `stopped`, `continued`, `terminated` 等事件驅動。
    *   禁止在 UI Component 層手動修改 `executionStateSubject`，必須透過暴露的方法（如 `startSession`, `disconnect`, `reset`）來轉移狀態。
    *   `terminated` 狀態後不會自動中斷連線，如需重啟，需顯式呼叫 `disconnect()` 後再次 `startSession()`。
    *   發生不可預期之斷線必須進入 `error` 狀態，且只能透過 `reset()` 統一清理並退回 `idle` 後，才能進行新的連線。
*   **R6: 請求合法性檢查**
    *   涉及執行緒資訊的請求（如 `stackTrace`, `scopes`, `variables`），在發送前必須檢查 `executionState === 'stopped'`。若處於 `running` 狀態，應視為非法操作或正確處理可能的回傳錯誤。

## 3. 分層架構約束 (Layering)

*   **R7: 無 UI 依賴性**
    *   `DapSessionService` 與所有 Transport 類別嚴禁注入任何 UI 相關服務（如 `MatSnackBar`, `MatDialog`, `Router`）。
    *   通訊層的錯誤應透過 `Promise.reject` 或 `appendDapLog` (via UI event layer) 拋出，由 UI 層負責顯示對話框。
*   **R8: 狀態橋接規律**
    *   所有底層 Transport 的狀態（如 `connectionStatus$`）必須透 Session 層的 `BehaviorSubject` 進行橋接，以確保 UI 在連線前即可安全訂閱。

## 4. 健壯性規範 (Robustness)

*   **R9: 請求逾時處理**
    *   所有 `sendRequest` 調用必須明確傳入 `timeoutMs`（預設為 5000ms），並正確處理 `Timeout Error` 以免造成 Pending Requests 洩漏。
*   **R10: 資源清理**
    *   在 `disconnect()` 中必須徹底銷毀 `transport` 實例，並將所有 `pendingRequests` 標記為 Reject 並清理。

## 5. C/C++ Source Listing 規範

*   **R11: Source Listing (動態載入) 行為限制**
    *   **限制在 Stopped 下請求**：因應底層除錯器限制，DA 的 `loadedSources` Request 只能在 target 處於 `stopped` 狀態下才能發送，若在 running 狀態下發送將可能導致失敗或非預期行為。
    *   **初始與動態載入觸發時機**：Client 必須在**第一次收到 `stopped` 事件**時，發送 `loadedSources` 取得初始 Source Tree。之後若程式動態載入函式庫 (`dlopen`)，Adapter 會強制 Target 進入 `stopped` 狀態並送出 `loadedSource` Event。Client 應依賴此 Event 作為後續重新拉取 source list 的觸發點，而非在每次一般暫停（如 stepping）時重載。
