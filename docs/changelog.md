# 任務典藏區 (Changelog Archive)

本文件紀錄了 DAP 偵錯器前端專案中，已經順利完工並交付的 Phase 與工作項目 (Work Items)。
這些項目從主工作清單 (`work-items.md`) 中移出，以保持開發清單的簡潔與專注。

---

## Phase 1：完善設定視圖 (Setup View)

### WI-01：擴充 `GdbConfigService` 組態模型
- **大小**：S
- **說明**：將 config 物件擴充為完整的 DAP 連線組態介面
- **內容**：
  - 定義 `DapConfig` interface（`serverAddress`, `launchMode: 'launch' | 'attach'`, `executablePath`, `sourcePath`, `programArgs`）
  - 更新 `GdbConfigService` 的 `setConfig()` / `getConfig()` 方法
  - 重新命名 service 為 `DapConfigService`（配合規格中通用 DAP 概念）
- **狀態**：✅ 已完成

### WI-02：Setup 表單欄位補齊 
- **大小**：M
- **說明**：根據規格書 §3.1，補齊所有 Setup 表單欄位
- **內容**：
  - 新增 **DAP Server 連線位址** 欄位（如 `localhost:4711`）
  - 新增 **啟動模式** 選擇器（`mat-button-toggle` 或 `mat-radio`：Launch / Attach）
  - 新增 **程式引數** 欄位（選填）
  - 按鈕文字隨 Launch Mode 動態切換（「Launch」/「Attach」）
- **依賴**：WI-01
- **狀態**：✅ 已完成

### WI-03：Setup 表單驗證
- **大小**：S
- **說明**：根據規格書 §7.3，實作即時表單驗證
- **內容**：
  - 改用 Reactive Forms（`FormGroup` + `Validators`）
  - 連線位址格式驗證（`host:port`）
  - 必填欄位驗證 + 行內錯誤訊息
  - Launch/Attach 按鈕在驗證失敗時 disable
- **依賴**：WI-02
- **狀態**：✅ 已完成

---

## Phase 2：DAP 通訊層 (Transport Layer)

### WI-04：建立 `DapTransportService` 抽象介面
- **大小**：S
- **說明**：根據規格書 §4，定義統一的通訊抽象層
- **內容**：
  - 定義抽象 class / interface `DapTransportService`
  - 方法：`connect()`, `disconnect()`, `sendRequest()`, `onEvent()` (Observable)
  - 定義 DAP Message 基礎型別（`DapRequest`, `DapResponse`, `DapEvent`）
- **狀態**：✅ 已完成

### WI-05：實作 WebSocket 通訊層 (`WebSocketTransportService`)
- **大小**：M
- **說明**：根據規格書 §4.2，實作 Web 模式下的 WebSocket 通訊
- **內容**：
  - 實作 `DapTransportService` 的 WebSocket 版本
  - WebSocket 連線/斷線管理
  - DAP 訊息序列化/反序列化（Content-Length header + JSON body）
  - 使用 RxJS Subject 發射接收到的事件
- **依賴**：WI-04
- **狀態**：✅ 已完成

### WI-06：DAP 會話管理服務 (`DapSessionService`)
- **大小**：M
- **說明**：封裝 DAP 協定的請求/回應生命週期
- **內容**：
  - `initialize()` → 交換 Capabilities
  - `launch()` / `attach()` → 根據設定啟動偵錯
  - `configurationDone()` → 通知 DAP Server
  - `disconnect()` → 終止會話
  - 管理 request sequence ID 與 pending response 對應
- **依賴**：WI-05
- **狀態**：✅ 已完成

### WI-07：DAP 請求逾時處理機制 (Timeout Mechanism)
- **大小**：S
- **說明**：為 `DapSessionService` 的請求實作超時機制，防止伺服器無回應時造成的永久等待
- **內容**：
  - 修改 `sendRequest` 方法，加入 `setTimeout` 等待上限 (例如 5秒)
  - 逾時發生時，清除 pending handler 並 reject `Promise`
- **依賴**：WI-06
- **狀態**：✅ 已完成

### WI-08：在 DebuggerComponent 整合 DapSessionService
- **大小**：S
- **說明**：負責在 DebuggerComponent 中實際調用 DapSessionService 啟動與終止偵錯會話
- **內容**：
  - 於 `ngOnInit` 執行 `initializeSession`、`launchOrAttach` 與 `configurationDone`
  - 於 `ngOnDestroy` 與 `goBack` 時呼叫 `disconnect` 以清除會話與連線
  - 訂閱 `onEvent()` 即時記錄基礎事件至 UI 日誌
  - 使用 `try/catch` 捕捉 timeout 錯誤，於 UI 顯示友善提示（如 `MatSnackBar` 或 `dapLogs`）
- **依賴**：WI-06, WI-07
- **狀態**：✅ 已完成

---

## Phase 4：偵錯控制核心 (Debug Controls)

### WI-10：偵錯控制按鈕功能化
- **大小**：M
- **說明**：將 toolbar 上的控制按鈕連接到 DAP 請求
- **內容**：
  - Continue → `continue` request
  - Step Over → `next` request
  - Step Into → `stepIn` request
  - Step Out → `stepOut` request（目前 template 中缺少此按鈕，需補上）
  - Pause → `pause` request
  - Stop → `disconnect` request
  - 按鈕狀態管理（Running 時只能 Pause/Stop，Stopped 時可 Continue/Step）
- **依賴**：WI-07
- **狀態**：✅ 已完成

### WI-11：DAP 事件處理與狀態管理
- **大小**：M
- **說明**：處理 DAP Server 回傳的事件，更新前端狀態
- **內容**：
  - `stopped` 事件 → 更新為暫停狀態，觸發 stackTrace/scopes/variables 查詢
  - `continued` 事件 → 更新為執行中狀態
  - `terminated` / `exited` 事件 → 更新為已終止狀態，通知使用者
  - `output` 事件 → 寫入主控台 log
  - `initialized` 事件 → 觸發 `configurationDone`
  - `breakpoint` 事件 → 更新斷點顯示狀態
- **依賴**：WI-07
- **狀態**：✅ 已完成

---

## Phase 6：檔案樹與原始碼載入 (File Explorer)

### WI-15：檔案樹服務抽象 (`FileTreeService`)
- **大小**：S
- **說明**：根據規格書 §3.2.2，定義檔案樹資料取得的抽象介面
- **內容**：
  - 定義 `FileNode` 介面（`name`, `path`, `type: 'file' | 'directory'`, `children?`）
  - 定義 `FileTreeService` 抽象（`getTree(rootPath)`, `readFile(path)`）
  - Web 模式：透過後端 API / WebSocket 取得遠端檔案樹
- **依賴**：無
- **狀態**：✅ 已完成

### WI-16：左側邊欄檔案樹 UI
- **大小**：M
- **說明**：將左側邊欄從硬編碼替換為動態檔案樹
- **內容**：
  - 使用 `mat-tree`（Flat 或 Nested）展示檔案/資料夾階層
  - 資料夾展開/收合功能
  - 點擊檔案 → 載入原始碼至 Monaco Editor
  - 當前開啟檔案高亮顯示
- **依賴**：WI-15
- **狀態**：✅ 已完成

---

## Phase 8：主控台與狀態列 (Console & Status Bar)

### WI-19：偵錯主控台功能化
- **大小**：M
- **說明**：根據規格書 §3.2.5，完善底部主控台
- **內容**：
  - 接收 DAP `output` 事件，依 category 分流至 Debugger Console / Program Console
  - 新增命令輸入欄位（input field），發送 `evaluate` request
  - 自動捲動至最新 log
  - Log 時間戳記顯示
- **依賴**：WI-11
- **狀態**：✅ 已完成

### WI-20：連線狀態指示器功能化
- **大小**：S
- **說明**：根據規格書 §3.2.5，將狀態列動態化
- **內容**：
  - 綁定 `DapTransportService` 的連線狀態 Observable
  - 綠燈 = 已連線、灰燈 = 未連線、紅燈 = 連線異常
  - 顯示連線位址資訊
  - 顯示目前偵錯狀態（Running / Stopped / Terminated）
- **依賴**：WI-05
- **狀態**：✅ 已完成

---

## Phase 11：自動化測試 (Automation Tests)

### TI-04：`DapFileTreeService` 檔案樹服務單元測試
- **大小**：M
- **說明**：驗證 `DapFileTreeService` 透過 DAP 請求建構檔案樹與讀取檔案內容的邏輯
- **內容**：
  - **getTree - 正常流程**：模擬 `loadedSources` 回傳多個 source，驗證 `buildTreeFromSources` 能正確建構出目錄/檔案的巢狀樹狀結構
  - **getTree - 路徑邏輯**：驗證不同路徑格式（絕對路徑 `/`、Windows 路徑 `C:\`）是否能被正確拆分與重組
  - **getTree - 排序**：驗證目錄優先、名稱字母排序是否正確
  - **getTree - 失敗 Fallback**：模擬 `loadedSources` 請求失敗，驗證是否回傳預設的 fallback 節點
  - **readFile - 正常流程**：模擬 `source` request 回傳內容，驗證 `content` 欄位是否被正確取出
  - **readFile - 失敗 Fallback**：模擬 `source` request 失敗，驗證是否回傳 fallback 字串
- **依賴**：WI-15
- **狀態**：✅ 已完成
