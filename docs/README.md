# DAP 偵錯器前端文件指南 (Documentation Index)

本目錄 (`/docs`) 包含了 DAP 偵錯器前端專案的所有核心設計、規格與開發進度文件。
為了協助新加入的開發者或維護者快速掌握專案，建議依以下順序閱讀：

## 1. 核心規格與設計 (Core Specifications & Design)

* 📄 **[系統規格書 (system-specification.md)](system-specification.md)**
  * **內容**：專案的最高指導原則。包含功能與 UI 佈局規範、Web / Electron 雙部署模式的差異，以及支援的 DAP 請求矩陣。
  * **適用時機**：需要了解系統整體目標、畫面該長什麼樣子、或者確認某個 DAP 功能是否在第一版支援範圍內時。

* 📄 **[系統分層架構說明書 (architecture.md)](architecture.md)**
  * **內容**：詳細解釋系統的「Session / Transport / UI」三層式架構、狀態機 (State Machine) 以及 RxJS 資料流的走向。
  * **適用時機**：準備開始寫 Code 前，需要理解架構依賴關係、知道某個功能該寫在哪一層（例如：不要在 UI 層直接呼叫 WebSocket）時。

## 2. 工程規範與測試 (Engineering & Testing)

* 📄 **[自動化測試計畫 (test-plan.md)](test-plan.md)**
  * **內容**：闡述專案的測試金字塔策略，包含單元測試、整合測試與 E2E 測試的範圍，以及對覆蓋率的要求。
  * **適用時機**：開發完新功能準備補測試，或想了解專案的 CI/CD 測試標準時。

* 📄 **[工作項目清單 (work-items.md)](work-items.md)**
  * **內容**：專案從零到一的 Phase 開發拆解、里程碑與當前各任務（WI-01 ~ WI-25）的完工狀態追蹤。
  * **適用時機**：尋找下一個可以接手開發的 Ticket、或是想了解目前專案整體進度時。

## 3. 開發排錯與技術指引 (Troubleshooting & Guides)

* 📄 **[DAP 技術指引 (dap-integration-faq.md)](dap-integration-faq.md)**
  * **內容**：針對 Debug Adapter Protocol 實作中最常踩到的坑（例如：重複 Launch、`loadedSources` 時機、非同步的 configurationDone 問題）提供詳細解答與最佳實踐。
  * **適用時機**：在串接 DAP Server 遇到行為不如預期，或是處理 Session 狀態發生 Race Condition 時。
