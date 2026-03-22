---
trigger: always_on
glob: "**/*.{ts,html,scss,css}"
description: Follow these coding standards to maintain consistency in the gdb-frontend project.
---

# 專案程式碼風格指南 (Code Style Guide)

本文件定義 `gdb-frontend` 專案的開發規範，旨在維持代碼的一致性、可讀性與現代 Angular 開發的最佳實踐。

## 1. 命名規範 (Naming Conventions)

### 檔案命名
*   **檔名格式**：一律使用 `kebab-case`。
*   **後綴規範**：
    *   Component: `*.component.ts`
    *   Service: `*.service.ts`
    *   Pipe: `*.pipe.ts`
    *   Directive: `*.directive.ts`
    *   Module/Config: `*.config.ts`, `*.routes.ts`
    *   Unit Test: `*.spec.ts`
    *   Type Definition: `*.types.ts`

### 類別與變數命名
*   **類別 (Classes/Interfaces)**：使用 `PascalCase`（例如：`DebuggerComponent`, `DapSessionService`）。
*   **變數與方法**：使用 `camelCase`（例如：`executionState`, `ngOnInit()`, `startSession()`）。
*   **常數**：全大寫蛇形命名法 `UPPER_SNAKE_CASE`（例如：`DEFAULT_TIMEOUT`）。
*   **Observable 變數**：字尾加上 `$` 符號（例如：`connectionStatus$`, `executionState$`).

## 2. Angular 開發規範

### 元件結構
*   **Standalone 元件**：本專案採用 Angular 21+ 的 **Standalone Components**。不再使用 `NgModule` 宣告元件。
*   **外置模板與樣式**：元件模板 (`.html`) 與樣式 (`.scss` 或 `.css`) 應與 `.ts` 檔案分開。
*   **依賴注入 (DI)**：推薦使用現代的 `inject()` 函式而非建構子注入。
    ```typescript
    private readonly configService = inject(DapConfigService);
    private readonly router = inject(Router);
    ```

### 服務與狀態管理
*   **單例服務**：預設情況下，非共用狀態的 Service 不應在 `providedIn: 'root'`，而是依據使用情境注入（如在元件的 `providers` 中）。
*   **響應式狀態**：使用 RxJS 的 `BehaviorSubject` 或 `Subject` 來管理元件間共享的狀態流。

## 3. TypeScript 規範

### 強型別定義
*   **明確宣告**：公有屬性與公開方法應明確標記回傳類型或資料型別。
*   **存取修飾詞**：明確使用 `public`, `private`, `protected` 修飾詞。預設注入的 Service 應設為 `private readonly`。

### 非同步處理
*   **Async/Await**：對於有順序性的非同步邏輯（如 DAP 握手流程），推薦使用 `async/await`。
*   **RxJS**：對於事件流（如 DAP 事件監聽）或狀態推播，應使用 `Observable`。
*   **轉換**：若需將 Observable 轉為 Promise，使用 `firstValueFrom`。

## 4. 語言與註解 (Language & Documentation)

*   **全域語言規範**: 
    *   所有 **程式碼註解** (Comments), **JSDoc**, 以及 **UI 顯示文字** (Template 中的文字) 必須統一使用 **美國英文 (US English)**。
    *   禁止在 `*.ts`, `*.scss`, `*.html` 等檔案中包含任何中文內容。
*   **註解規範**:
    *   **邏輯說明**：針對複雜邏輯的流程說明，使用 **美國英文** 以方便國際開發團隊理解。
    *   **JSDoc**：公開方法與介面描述使用 **English JSDoc**。
*   **程式碼分段**：對於較長的 Service 或 Component，使用明顯的分隔線區分邏輯區塊：
    ```typescript
    // ── Session Event Handling ─────────────────────────────────────────
    ```

## 5. 格式化規範 (Formatting)

*   **縮排**：2 個空格。
*   **引號**：單引號 `'`（TypeScript/JavaScript），雙引號 `"` (HTML)。
*   **分號**：必須使用分號 `;`。
*   **Import 排序**：
    1.  Angular 核心與內建模組 (`@angular/*`)
    2.  第三方函式庫 (RxJS, Angular Material)
    3.  專案本地檔案 (Local imports)

## 6. RxJS 管理

*   **資源回收**：在 `ngOnDestroy` 中必須正確呼叫 `unsubscribe()`，或使用 `takeUntil` 等運算子避免記憶體洩漏。
*   **不可變性**：對於 UI 顯示的陣列（如 Log 紀錄），應使用展開運算子 `[...]` 建立新引用以觸發 Angular 的 `OnPush` 或缺設變更檢查。
    ```typescript
    this.dapLogs = [...this.dapLogs, newEntry];
    ```
