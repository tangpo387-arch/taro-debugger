---
trigger: always_on
glob: "src/app/**/*.spec.ts"
description: 規範測試架構與自動化測試流程，包含 Vitest 的執行方式與 Mock 策略。
---

# 測試規範與實作指南 (Testing Protocol)

本文件定義 `taro-debugger` 專案的單元測試與整合測試規範，確保開發過程中的功能正確性與迴歸測試能力。

## 1. 測試環境執行

本專案使用 **Vitest** 作為主要的測試運行器 (Test Runner)，並整合在 Angular CLI 中。

*   **執行所有測試**: 
    ```bash
    npm test
    ```
    或
    ```bash
    ng test
    ```
*   **介面化執行 (UI Mode)**:
    若需詳細查看測試路徑與圖形化介面，可執行：
    ```bash
    npx vitest --ui
    ```

## 2. Mock 策略 (Mocking Strategy)

在測試 Service 或 Component 時，通常需要隔離底層的 DAP 通訊。

### 2.1 Mock `DapSessionService`
當測試 UI 元件或衍生 Service (如 `DapFileTreeService`) 時，應使用 `vi.fn()` 模擬 `sendRequest` 等非同步方法。

範例 (`dap-file-tree.service.spec.ts`):
```typescript
import { vi } from 'vitest';

function makeMockSession(responseBody?: any) {
  return {
    sendRequest: vi.fn().mockImplementation((command, args) =>
      Promise.resolve({
        success: true,
        command,
        body: responseBody
      })
    )
  };
}
```

### 2.2 Mock `DapTransportService`
當測試 `DapSessionService` 本身時，需要模擬底層的 Transport 事件流。應使用 `Subject` 來手動推送訊息。

範例:
```typescript
import { Subject } from 'rxjs';
import { vi } from 'vitest';

const mockMessage$ = new Subject<any>();
const mockTransport = {
  connect: vi.fn().mockReturnValue(of(void 0)),
  onMessage: () => mockMessage$.asObservable(),
  sendRequest: vi.fn()
};

// 推送模擬事件
mockMessage$.next({ type: 'event', event: 'stopped', body: { threadId: 1 } });
```

## 3. 測試撰寫原則

*   **Async/Await**: 對於涉及 Promise 的 DAP 請求，優先使用 `async/await` 語法撰寫測試案例。
*   **Observable 測試**: 使用 `firstValueFrom` 將 `Observable` 轉為 `Promise` 以便進行 `expect` 斷言。
*   **Cleanup**: 確保測試案例不會互相干擾，必要時在 `afterEach` 中進行清理。
