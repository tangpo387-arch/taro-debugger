---
trigger: always_on
glob: "src/app/**/*.{ts,html}"
description: 規範全域狀態管理路徑，確保 DapSessionService 作為真相來源 (SSOT)，避免冗餘的 Props 傳遞。
---

# 狀態管理與 SSOT 規範 (State Management Rules)

本文件定義 `taro-debugger-frontend` 專案中，「狀態」應該存放的位置，旨在維持 Reactive 響應式架構，並避免 AI 在修改 UI 時引入過多的冗餘 Props 傳遞（Prop Drilling）。

## 1. 真相來源 (Single Source of Truth, SSOT)

*   **R_SM1: `DapSessionService` 作為核心真相來源**
    *   所有關於 DAP 會話的「當前狀態」（例如：`executionState`, `connectionStatus`, `capabilities`, `stackFrames`）必須存放在 `DapSessionService` 中。
    *   禁止在不同 Component 之間手動傳遞這些核心狀態的副本。
*   **R_SM2: 雙向綁定限制**
    *   UI Component 不應持有核心狀態的「寫入權限」，除非是透過調用 `DapSessionService` 的公開方法（如 `continue()`, `stepOver()`）來觸發狀態轉移。

## 2. 狀態存放位置區分

| 狀態類型 | 建議存放位置 | 範例 | 存取方式 |
| :--- | :--- | :--- | :--- |
| **全域/會話狀態** | `DapSessionService` | `executionState`, `connectionStatus` | 透過 `inject(DapSessionService)` 訂閱 Observable |
| **會話衍生狀態** | `DapSessionService` 或具邏輯的 Service | `stackFrames`, `scopes`, `variables` | Service 暴露 Subject/Observable，UI 使用 `async` pipe |
| **UI 局部狀態** | `Component` 類別私有屬性 | `isSidebarExpanded`, `selectedTabIndex`, `hoveredLine` | 直連 HTML 模板 |
| **輸入與快取狀態** | `Component` | `evaluateExpression` (Input 字串) | `[(ngModel)]` 或 `FormControl` |

## 3. 響應式存取規範

*   **R_SM3: 優先使用 Async Pipe**
    *   在 HTML 模板中，應優先使用 `dapSession.executionState$ | async` 或 `dapSession.connectionStatus$ | async`。
    *   避免在 Component 中手動 `subscribe` 並存入局部變數，除非該狀態需要結合複雜的過濾或組合邏輯。
*   **R_SM4: 禁止冗餘的父子 Component Props**
    *   若子元件需要 `executionState` 等全域狀態，應自行 `inject(DapSessionService)`，而非由父元件透過 `@Input()` 傳入。這樣可以確保系統解耦，並減少層層傳遞的維護負擔。

## 4. 懶加載與清除規範

*   **R_SM5: 元件銷毀時的狀態清理**
    *   儲存在 Service 中的狀態（如 Log 紀錄）應在 `DapSessionService.disconnect()` 或 `reset()` 退回 `idle` 時統一清理。
    *   UI 相關的局部 Subscription 必須在 `ngOnDestroy` 中取消。
