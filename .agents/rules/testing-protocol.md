---
trigger: glob
description: Defines the test architecture and automated testing workflow, including Vitest execution and mocking strategies.
globs: src/app/**/*.spec.ts
---

# Testing Protocol

<protocol_overview>
This document defines the unit and integration testing standards and architectural strategies for the `taro-debugger` project.

**Test Runner**: The project uses **Vitest** as the primary test runner. Command line execution rules are located in [`.agents/project-context.md`](../project-context.md).
</protocol_overview>

<mocking_strategy>
## 1. Mocking Strategy

When testing Services or Components, it is often necessary to isolate underlying DAP communication.

### 1.1 Mocking `DapSessionService`
When testing UI components or derived services (such as `DapFileTreeService`), use `vi.fn()` to simulate asynchronous methods like `sendRequest`.

Example (`dap-file-tree.service.spec.ts`):
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

### 1.2 Mocking `DapTransportService`
When testing `DapSessionService` itself, you need to simulate the underlying Transport event stream. Use a `Subject` to manually push messages.

Example:
```typescript
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

const mockMessage$ = new Subject<any>();
const mockTransport = {
  connect: vi.fn().mockReturnValue(of(void 0)),
  onMessage: () => mockMessage$.asObservable(),
  sendRequest: vi.fn()
};

// Push simulated event
mockMessage$.next({ type: 'event', event: 'stopped', body: { threadId: 1 } });
```
</mocking_strategy>

<test_principles>
## 2. Test Writing Principles

*   **Async/Await**: For DAP requests involving Promises, prioritize using `async/await` syntax in test cases.
*   **Observable Testing**: Use `firstValueFrom` to convert an `Observable` to a `Promise` for `expect` assertions.
*   **Cleanup**: Ensure test cases do not interfere with each other; use `afterEach` for cleanup when necessary.
</test_principles>