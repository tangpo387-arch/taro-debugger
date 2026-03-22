# 專案背景與術語 (Project Context & Terminology)

本文件提供 `taro-debugger` 專案的核心背景資訊，旨在幫助 AI Agent 理解當前開發環境、整合技術與專用術語，避免產生不符語言特性的邏輯（例如在 C++ 背景下使用 Java 概念）。

## 1. 專案概述 (Project Overview)

*   **目標**: 為 GDB/LLDB 提供現代化、跨平台的網頁前端偵錯介面。
*   **技術棧**:
    *   **Frontend**: Angular 21+, Standalone Components.
    *   **Styling**: Vanilla CSS (TailwindCSS 排除).
    *   **Editor**: Monaco Editor (透過 WebSocket 傳遞數據).
    *   **Protocol**: Debug Adapter Protocol (DAP).
*   **語言支援範圍**: 目前專注於 **C/C++** 語言的偵錯。因此在處理路徑、符號、指針 (Pointer) 時應考慮 Unix/Windows 的差異與 C-style 的記憶體佈局。

## 2. 核心架構元件

*   **DapSessionService**: 整體會話的真相來源 (SSOT)。負責協調 `initialize`, `launch`, `configurationDone` 等請求與 `stopped`, `output` 等事件。
*   **Transport 層**: 目前採取抽象化設計，主要實作為 `WebSocketTransportService`。設計上已預留對其他傳輸協定（如 **Serial**, **TCP Direct**）的擴充性，透過 `DapTransportService` 抽象類別與 `createTransport` 工廠模式進行解耦。
*   **Monaco Editor**: 負責顯示原始碼、斷點列 (Glyph Margin) 以及當前執行行的高亮顯示。
    *   *註：Monaco 的 `deltaDecorations` 是動態高亮的核心。*

## 3. 重要術語 (Terminology)

| 術語 | 定義 / 在 DAP 中的角色 |
| :--- | :--- |
| **DAP (Debug Adapter Protocol)** | 由 VS Code 定義的標準偵錯協定，前端與偵錯器 (Adapter) 間溝通的橋樑。 |
| **Debug Adapter (DA)** | 負責轉換 DAP 命令到特定偵錯器 (如 gdb-dap) 的中間層。 |
| **Stack Frame (堆疊幀)** | 程式停止時的一個執行層級。包含 `line`, `column`, `source` 等資訊。 |
| **Thread (執行緒)** | 程式執行的一個路徑。每個 `stopped` 事件通常會帶有一個 `threadId`。 |
| **Variables Reference** | 一個數值 ID，用來懶加載 (Lazy loading) 複雜物件或作用域 (Scopes) 的成員內容。 |
| **Source Reference** | 當原始碼不是來自實體路徑，而是由 DA 提供的虛擬內容時使用的 ID。 |

## 4. 行為約束事項

*   **路徑處理**: C/C++ 原始碼路徑可能使用 `/` (Unix) 或 `\` (Windows)，應確保 `DapFileTreeService` 與 `EditorComponent` 能正確解析。
*   **非同步流程**: 嚴格遵守 `initialized` → `configurationDone` → `launch/attach` response 的時序。
*   **資源回收**: 任何 WebSocket 訂閱或 Timer 必須在 `disconnect()` 或 `ngOnDestroy` 中清理，防止多個會話 (Sessions) 同時運行造成的 Buffer 亂序。
