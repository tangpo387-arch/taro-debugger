---
title: DAP Protocol Implementation Specs
scope: protocol, session, transport
audience: [Lead_Engineer, Quality_Control_Reviewer]
---
# DAP Protocol Implementation Specs (Agent-Specific Rules)

This document defines the mandatory rules that AI Agents must follow when modifying DAP-related Services to prevent Race Conditions, Deadlocks, or generating code that violates the layered architecture.

> [!NOTE]
> For detailed reasoning behind the protocol design and FAQ, please refer to: [docs/dap-integration-faq.md](../../../docs/dap-integration-faq.md)
> For architectural layering details, please refer to: [docs/architecture.md](../../../docs/architecture.md)

---

## 1. Sequence Enforcement

When modifying `DapSessionService.startSession()` or related startup logic, you must strictly adhere to the following sequence:

* **R1: `initialized` Event Priority**
  * It is forbidden to send `setBreakpoints` or `configurationDone` Requests before receiving the `initialized` **Event**.
  * **Adapter Behavior Differences (Both comply with DAP Spec):**
    * `gdb -i=dap`: Sends the `initialized` Event **immediately** after the `initialize` Response is returned (no need to wait for `launch`).
    * `lldb-dap`: Sends the `initialized` Event only **after** receiving the `launch`/`attach` Request.
  * **Universal Compatible Implementation (Mandatory):** The Client must immediately send the `launch`/`attach` Request in a **fire-and-forget** manner right after the `initialize` Response is completed, **and then** await the `initialized` Event. You must absolutely never send the `launch` request after awaiting `initialized`, otherwise it will cause a two-way Deadlock for `lldb-dap`.
* **R2: `launch/attach` Requests Must Precede `configurationDone`**
  * The `configurationDone` **Request** can only be sent after the `launch` or `attach` **Request** has been sent out.
* **R3: Asynchronous Unblocking (Deadlock Prevention)**
  * When sending a `launch/attach` Request, follow the **fire-and-forget** pattern (i.e., send the request first, but do not await the response at that exact location immediately).
  * You must await the Response of `configurationDone` first, and only then await the Response of `launch/attach`.
* **R4: Client-Side Event Handling Sequence**
  * The Client side must complete the `initialize` Request/Response exchange (obtaining Capabilities) before it can process the `initialized` Event.
  * Regardless of when the `initialized` Event arrives at the underlying transport layer (before or after `launch`), the **event handling logic** on the Client side must remain blocked until the `initialize` Response is fully processed.

## 2. State Machine

* **R5: State Transition Uniqueness & Rules**
  * `ExecutionState` must be driven by events like `stopped`, `continued`, `terminated`.
  * Manually modifying `executionStateSubject` at the UI Component layer is forbidden; state transitions must be triggered via exposed methods (e.g., `startSession`, `disconnect`, `reset`).
  * The connection does not automatically drop after reaching the `terminated` state. To restart, you must explicitly call `disconnect()` followed by `startSession()` again.
  * Unexpected disconnections must transition to the `error` state, and a new connection can only be established after a unified cleanup via `reset()`, falling back to `idle`.
* **R6: Request Legality Checks**
  * Requests involving thread information (e.g., `stackTrace`, `scopes`, `variables`) must verify `executionState === 'stopped'` prior to being sent. If the state is `running`, the action should be deemed illegal, or returning errors should be correctly handled.

## 3. Layering

* **R7: No UI Dependencies**
  * `DapSessionService` and all Transport classes are strictly prohibited from injecting any UI-related services (such as `MatSnackBar`, `MatDialog`, `Router`).
  * Errors from the communication layer should be thrown via `Promise.reject` or `appendDapLog` (via the UI event layer) and handled by the UI layer to display dialog boxes.
* **R8: State Bridging Rules**
  * All underlying Transport states (like `connectionStatus$`) must be bridged through the Session layer's `BehaviorSubject` to ensure the UI can subscribe to them safely even before a connection is established.

## 4. Robustness

* **R9: Request Timeout Handling**
  * All `sendRequest` calls must explicitly pass a `timeoutMs` (defaults to 5000ms) and correctly handle `Timeout Error` to prevent Pending Requests from leaking.
* **R10: Resource Cleanup**
  * Within `disconnect()`, the `transport` instance must be thoroughly destroyed, and all `pendingRequests` must be marked as Rejected and cleared.

## 5. C/C++ Source Listing Constraints

* **R11: Source Listing (Dynamic Loading) Behavior Constraints**
  * **Restricted to Stopped State:** Due to underlying debugger limitations, the DA's `loadedSources` Request can only be dispatched when the target is in the `stopped` state. Sending it while `running` may lead to failure or unexpected behavior.
  * **Initial & Dynamic Loading Triggers:** The Client must send `loadedSources` upon the **first received `stopped` event** to obtain the initial Source Tree. If the program dynamically loads libraries later (e.g., via `dlopen`), the Adapter forces the Target into a `stopped` state and emits a `loadedSource` Event. The Client should rely on this Event to trigger subsequent source list refetches rather than reloading it during general pauses (like stepping).

## 6. Transport Extension Guide

To add a new transport type, follow these steps:

1. **Create a new Service**: Extend `DapTransportService`, implement all abstract methods.
2. **Register the type**: Add a new option to the `TransportType` union type in `DapConfig`.
3. **Register with factory**: Add the corresponding `case` in `TransportFactoryService.createTransport()`.

> **Note**: The Session layer and UI layer require no modifications whatsoever, adhering to the Open/Closed Principle (OCP).

### Key Abstract Interface

```typescript
abstract class DapTransportService {
  abstract connect(address: string): Observable<void>;
  abstract disconnect(): void;
  abstract sendRequest(request: DapRequest): void;
  abstract onMessage(): Observable<DapMessage>;  // All message stream (Response/Event)
  abstract get connectionStatus$(): Observable<boolean>;
}
```
