# **DAP 偵錯器前端系統規格書 (v1.0)**

## **1. 專案概述**

本專案之核心目的在於建構一基於 Angular 架構之通用偵錯器前端介面 (DAP Frontend)，同時支援 Electron 桌面應用程式與 Web 偵錯應用程式兩種部署模式。其設計目標為提供開發人員具備高度專業性、比擬 Visual Studio Code 之整合式開發環境 (Integrated Development Environment, IDE) 體驗。該系統將全面支援程式碼編輯、斷點設置 (Breakpoint Configuration)、變數監控 (Variable Inspection) 及逐步執行 (Step Execution) 等核心偵錯機能，並可介接任何遵循偵錯適配器協定 (Debug Adapter Protocol, DAP) 之伺服器實作。

## **2. 技術選型 (Tech Stack)**

* **核心框架 (Core Framework)**：採用 Angular 21 或更新版本，並全面導入獨立元件 (Standalone Components) 架構，以提升模組化程度與渲染效能。  
* **桌面應用程式框架 (Desktop Application Framework)**：選用 Electron 作為底層架構，於桌面模式下專責橋接作業系統底層資源與 DAP 伺服器之通訊。  
* **Web 通訊層 (Web Communication Layer)**：於 Web 瀏覽器模式下，採用 WebSocket 作為與 DAP Server 之通訊管道，無需 Electron 支持。  
* **使用者介面元件庫 (UI Component Library)**：導入 Angular Material，以建構符合現代化與響應式設計原則之使用者介面元件。  
* **編輯器核心 (Editor Core)**：整合 Monaco Editor (經由 ngx-monaco-editor-v2 模組套件)，藉此提供語法高亮顯示 (Syntax Highlighting) 及進階程式碼編輯功能。  
* **狀態與路由管理 (State & Routing)**：利用 Angular Router 實作多視圖切換，並藉由依賴注入 (Dependency Injection, DI) 之服務 (Service) 跨視圖共享偵錯初始配置參數。

## **3. 視圖導航與介面佈局規範 (View Navigation & Layout Specification)**

本系統採行雙視圖 (Dual-View) 導航架構，以確保偵錯環境之初始化參數於進入核心作業區前已妥善配置。整體視圖劃分如下：

### **3.1 初始化設定視圖 (Initialization Setup View, /setup)**

此視圖為系統啟動後之預設著陸頁面 (Landing Page)，專司收集啟動偵錯工作所需之前置環境參數。

* **配置表單 (Configuration Form)**：以 \<mat-card\> 封裝表單區塊，提供使用者輸入以下關鍵參數：  
  * **DAP Server 連線位址 (Connection Endpoint)**：DAP Server 之連線埠號或位址（如 localhost:4711）。目前僅支援 C/C++ 語言之偵錯適配器。
  * **啟動模式 (Launch Mode)**：提供 **Launch**（啟動新程序）與 **Attach**（附加至現有程序）兩種模式選擇。  
  * **執行檔路徑 (Executable File Path)**：目標偵錯二進位檔案之絕對或相對路徑。於 Web 模式下，此路徑指向 DAP Server 所在主機之檔案系統路徑。  
  * **原始碼路徑 (Source File Path)**：對應之專案原始碼目錄或主檔案路徑。於 Web 模式下，同樣指向遠端檔案系統路徑。  
  * **程式引數 (Program Arguments)**：選填，傳遞給目標程式之啟動引數。  
* **連線觸發機制 (Connection Trigger)**：配置一主按鈕，依所選啟動模式顯示對應文字（Launch / Attach）。使用者觸發後，系統將參數寫入全域組態服務 (Configuration Service)，並透過 Angular Router 轉址至核心偵錯視圖。

### **3.2 核心偵錯視圖 (Core Debugger View, /debug)**

本視圖之佈局設計遵循標準整合式開發環境之三段式架構。為確保各介面區塊間互動與連動之流暢性，底層佈局容器統一採用 \<mat-sidenav-container\> 進行封裝。

#### **3.2.1 頂部工具與導航列 (Top Toolbar)**

本區塊配置 \<mat-toolbar\> 以作為系統之全域控制樞紐。

* **品牌識別區 (Brand Area)**：動態呈現應用程式名稱或當前載入之專案名稱。  
* **偵錯控制模組 (Debug Control Module)**：配置 mat-button-toggle-group 元件以整合核心偵錯指令操作（Continue, Step Over, Step Into, Step Out, Pause, Stop）。

#### **3.2.2 左側導航與資源管理 (Left Sidenav)**

本區塊運用 \<mat-sidenav\>（設定 position="start"）以實踐專案資源與檔案之管理機能。

* **元件呈現**：採用 mat-nav-list 展示專案資料夾與檔案階層。於 Electron 模式下透過 Node.js API 讀取本機檔案系統；於 Web 模式下透過後端 API 取得遠端檔案樹。  
* **顯示模式**：系統預設採行 side 模式，允許使用者自由展開或摺疊面板。

#### **3.2.3 核心編輯器區域 (Main Content Area)**

此區域封裝於 \<mat-sidenav-content\> 標籤內，係使用者進行程式碼檢視與偵錯之主要互動空間。

* **編輯器主體 (app-editor)**：  
  * **高度限制規範**：編輯器區域應自適應填滿剩餘可用空間。  
  * **進階互動機能**：啟用 Monaco Editor 之 Glyph Margin 提供斷點設置，並介接 deltaDecorations 實作執行行高亮標示。

#### **3.2.4 右側資訊面板 (Right Sidenav)**

配置第二組 \<mat-sidenav\>（設定 position="end"），專司偵錯期間各項運行數據之視覺化呈現。

* **變數檢視器 (Variable Inspector)**：導入 mat-tree 展示巢狀變數物件，並視資料規模整合 CDK Virtual Scroll。  
* **呼叫堆疊 (Call Stack)**：利用 mat-list 或 mat-table 呈現當前執行緒之呼叫上下文。

#### **3.2.5 底部狀態列與主控台 (Status Bar & Console)**

部署於佈局最底層，負責反饋系統運行狀態與通訊日誌。

* **連線狀態指示器**：動態綁定 isDapConnected，以綠/灰燈號表徵連線狀態。  
* **偵錯主控台**：底層採用 cdk-virtual-scroll-viewport，呈現偵錯系統日誌與應用程式輸出，並提供自訂指令輸入欄位。

## **4. 系統通訊架構 (Communication Architecture)**

為確保前端介面與底層偵錯適配器 (Debug Adapter) 間之有效互動與資料同步，系統依部署模式提供兩套通訊路徑。前端應用層透過統一的抽象服務介面 (DapTransportService) 封裝底層差異，使上層元件無需感知當前運行於何種模式。

### **4.1 Electron 桌面模式**

適用於以 Electron 封裝之桌面應用程式，通訊路徑如下：

1. **使用者介面層 (UI Layer, Angular)**：負責捕捉並發送使用者之操作指令。  
2. **進程間通訊層 (IPC Layer, Electron)**：Angular 應用程式透過 contextBridge 呼叫進程間通訊 (IPC) 方法。  
3. **偵錯適配器協定層 (DAP Layer)**：Electron 主進程將 IPC 指令轉譯為標準偵錯適配器協定 (DAP) 訊息，與各語言之 DAP Server 通訊，並將結果回傳前端。

### **4.2 Web 瀏覽器模式**

適用於純 Web 部署之偵錯應用程式，通訊路徑如下：

1. **使用者介面層 (UI Layer, Angular)**：與桌面模式共用同一套 Angular 元件與服務。  
2. **WebSocket 通訊層**：Angular 應用程式透過 WebSocket 連線至遠端 DAP Server 或中繼代理伺服器 (Relay Proxy)，直接傳輸 DAP 協定訊息。  
3. **偵錯適配器協定層 (DAP Layer)**：DAP Server 接收 WebSocket 訊息，執行偵錯操作並將結果即時串流回傳前端。

#### **4.2.1 WebSocket 傳輸層規格與防呆要求**

由於 WebSocket 資料流之特性，前端緩衝區的實作應遵守以下嚴格規範以確保系統正確性與防呆能力：
* **嚴格 Header 檢驗**：傳入之 DAP 資料流必須嚴格由 `Content-Length: <長度>\r\n\r\n` 表頭（Header）引導。系統不得嘗試在缺乏此合法 Header 之狀況下盲目解析資料串流（例如：禁止直接尋找大括號 `{}` 解析 JSON），且首字元必須為 `'C'`。
* **錯誤隔離與阻斷 (Fail-Fast Mechanism)**：若 WebSocket 傳輸層偵測到任何一個封包之格式異常（包含：不支援的二進位型別、缺失 Header 欄位、或 1KB 內未能尋獲合法 Header 結尾等），系統應**永久終止當前之訊號匯流排 (Message Subject is errored)**。這意味著：只要有一個封包損毀出錯，整個 WebSocket 訊息接收機制將主動進入失效狀態，不再接收後續不確定狀態的封包，避免系統因讀取到錯位之串流而在使用者介面上產生難以預測的錯誤。使用者必須重新建立連線 (`connect()`) 始能恢復偵錯作業。

## **5. DAP 協定支援範圍 (DAP Protocol Support Scope)**

本系統基於偵錯適配器協定 (Debug Adapter Protocol) 規範，實作以下核心請求與事件。目前僅支援 C/C++ 語言之偵錯適配器，未來可依需求擴展至其他語言。

### **5.1 支援之 DAP 請求 (Requests)**

| 請求類型 | 說明 |
|---|---|
| `initialize` | 初始化 DAP 會話，交換前後端能力 (Capabilities) |
| `launch` | 啟動目標程式進行偵錯 |
| `attach` | 附加至現有執行中之程序 |
| `setBreakpoints` | 設置或更新指定檔案之斷點 |
| `configurationDone` | 通知 DAP Server 前端配置完成，可開始執行 |
| `continue` | 繼續執行程式 |
| `next` | 逐步執行（Step Over） |
| `stepIn` | 步入函式（Step Into） |
| `stepOut` | 步出函式（Step Out） |
| `pause` | 暫停執行中之程式 |
| `stackTrace` | 取得當前執行緒之呼叫堆疊 |
| `scopes` | 取得指定堆疊框架之變數範圍 |
| `variables` | 取得指定範圍內之變數清單與數值 |
| `threads` | 取得所有執行緒資訊 |
| `disconnect` | 終止偵錯會話並斷開連線 |

### **5.2 支援之 DAP 事件 (Events)**

| 事件類型 | 說明 |
|---|---|
| `initialized` | DAP Server 初始化完成，前端可發送配置請求 |
| `stopped` | 程式於斷點、例外或使用者操作而暫停 |
| `continued` | 程式恢復執行 |
| `terminated` | 偵錯目標程式已終止 |
| `exited` | 偵錯目標程式已退出，包含退出碼 |
| `output` | DAP Server 輸出訊息（主控台、標準輸出等） |
| `breakpoint` | 斷點狀態變更通知 |

## **6. 部署模式說明 (Deployment Modes)**

本系統支援兩種部署模式，共用同一套 Angular 前端程式碼，僅於通訊層與系統存取層存在差異。

### **6.1 Electron 桌面模式**

* **適用情境**：需要直接存取本機檔案系統之場景。  
* **檔案存取**：透過 Electron 主進程之 Node.js API 讀寫本機檔案或透過後端 API 或中繼代理伺服器存取遠端檔案系統。  
* **DAP Server 生命週期**：使用者自行管理，Electron僅負責連線至已運行之 DAP Server。
* **限制**：需安裝桌面應用程式。

### **6.2 Web 瀏覽器模式**

* **適用情境**：遠端偵錯、雲端開發環境、或無法安裝桌面應用程式之場景。  
* **檔案存取**：透過後端 API 或中繼代理伺服器存取遠端檔案系統。  
* **DAP Server 生命週期**：由後端服務或使用者自行管理，前端僅負責連線至已運行之 DAP Server。  
* **限制**：受瀏覽器安全策略限制，無法直接存取本機檔案系統與啟動本地程序。

### **6.3 模式差異對照表**

| 能力 | Electron 桌面模式 | Web 瀏覽器模式 |
|---|---|---|
| 本機檔案存取 | ✅ 直接存取 | ❌ 需透過後端 API |
| DAP Server 啟動 | ❌ 需預先啟動 | ❌ 需預先啟動 |
| 通訊管道 | IPC (contextBridge) | WebSocket |
| 安裝需求 | 需安裝桌面應用 | 僅需瀏覽器 |
| 遠端偵錯 | ✅ 支援 | ✅ 支援 |

## **7. 錯誤處理與使用者回饋機制 (Error Handling & User Feedback)**

為確保系統於異常情境下仍能提供清晰之使用者回饋，定義以下錯誤處理策略：

### **7.1 連線異常處理**

* **連線逾時 (Connection Timeout)**：若於設定時限內無法連線至 DAP Server，系統應顯示錯誤提示對話框，並提供重試選項。  
* **連線中斷 (Connection Lost)**：偵錯過程中連線意外中斷時，系統應立即更新狀態指示器為斷線狀態，並於主控台輸出斷線原因。  
* **重連機制 (Reconnection)**：提供手動重連按鈕，允許使用者於排除問題後重新建立連線。

### **7.2 DAP Server 異常處理**

* **程序異常終止**：若 DAP Server 非預期終止，系統應捕捉事件並透過通知元件 (如 MatSnackBar) 告知使用者。  
* **無效回應 (Invalid Response)**：收到不符合 DAP 協定之回應時，系統應記錄原始訊息至主控台日誌，並忽略該筆無效訊息。

### **7.3 使用者配置驗證**

* **表單驗證 (Form Validation)**：初始化設定視圖之表單欄位應即時驗證輸入格式（如連線位址格式、必填欄位檢查），並於驗證失敗時顯示行內錯誤訊息。  
* **啟動前檢查 (Pre-launch Check)**：點擊 Launch/Attach 按鈕前，系統應驗證所有必要參數已填寫且格式正確，否則阻止操作並提示缺漏項目。