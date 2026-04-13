---
title: Test Plan (Index)
scope: testing, vitest, unit-tests, integration-tests, e2e, coverage
audience: [Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-13
related:
  - docs/work-items.md
  - docs/system-specification.md
---

# DAP Debugger Frontend — Test Plan (Index)

> [!NOTE]
> This document is the **master index** for the project's test architecture and toolchain.
> All specific test case definitions have been extracted into per-module spec-plan files under `docs/tests/`.

---

> [!IMPORTANT]
> **Agent mandatory rule**: This index file alone is **insufficient** for writing tests.
> Before implementing or reviewing any test, you **MUST** open and read the corresponding
> `docs/tests/*.spec-plan.md` file listed in §2 below.
> Proceeding without reading the spec-plan file is a protocol violation.

---

## 1. Test Strategy & Architecture

The project follows the **Test Pyramid** principle, concentrating most tests on fast-executing, highly stable unit and integration tests, supplemented by a small number of end-to-end (E2E) tests to ensure overall flow correctness.

### 1.1 Toolchain

* **Unit & Integration Tests**: Using **Vitest** + **jsdom** for the high-frequency abstract-layer logic validation in this project.
* **End-to-End Tests (E2E)**: Recommending **Playwright**, due to its native and powerful support for WebSocket communication interception and Electron desktop application testing.
* **Assertions & Mocking**: Using Vitest's built-in `expect` and `vi.mock()` / `vi.spyOn()` for isolated testing.

---

## 2. Spec-Plan File Index

Each file below corresponds to a specific module or test level. **Open and read the matching spec-plan file before writing or reviewing any test** — do not rely solely on this index.

### 2.1 Unit Tests — Core Services

| Spec-Plan File | Target Module |
| :--- | :--- |
| [unit-dap-config.spec-plan.md](tests/unit-dap-config.spec-plan.md) | `DapConfigService` |
| [unit-dap-session.spec-plan.md](tests/unit-dap-session.spec-plan.md) | `DapSessionService` |
| [unit-websocket-transport.spec-plan.md](tests/unit-websocket-transport.spec-plan.md) | `WebSocketTransportService` |
| [unit-dap-variables.spec-plan.md](tests/unit-dap-variables.spec-plan.md) | `DapVariablesService` |

### 2.2 Unit Tests — UI Components

| Spec-Plan File | Target Module |
| :--- | :--- |
| [unit-setup.spec-plan.md](tests/unit-setup.spec-plan.md) | `SetupComponent` |
| [unit-file-explorer.spec-plan.md](tests/unit-file-explorer.spec-plan.md) | `FileExplorerComponent` |
| [unit-debugger.spec-plan.md](tests/unit-debugger.spec-plan.md) | `DebuggerComponent` |

### 2.3 Integration Tests

| Spec-Plan File | Coverage |
| :--- | :--- |
| [integration.spec-plan.md](tests/integration.spec-plan.md) | DAP Launch Flow, Event-Driven State Sync, FileExplorer ↔ Debugger, Breakpoint & Editor Sync, Connection Error Detection |

### 2.4 E2E & Manual Verification

| Spec-Plan File | Coverage |
| :--- | :--- |
| [e2e.spec-plan.md](tests/e2e.spec-plan.md) | Happy path, Error path (Mock DAP Server) |
| [manual-verification.spec-plan.md](tests/manual-verification.spec-plan.md) | Visual & UX checks, Live breakpoint DAP sync |

---

## 3. CI/CD Integration

1. **Local Execution Commands**
   * Unit/Integration tests: `npm run test -- --watch=false`
   * Run a single test file: `npm run test -- --include=<path/to/file.spec.ts> --watch=false`
   * Watch mode: `npm run test`
2. **Pull Request Validation**
   * Every PR submitted to the main branch must run `npm run test` in headless mode on the CI Server (e.g., GitHub Actions); all tests must pass before merging.
3. **Coverage Requirements**
   * Unit test coverage (Line/Branch Coverage) for core business logic (such as `DapSessionService` and `WebSocketTransportService`) should target **85% or above**, to ensure the most fragile async data flows are protected.

---

## 4. Test Writing Best Practices

> [!NOTE]
> Detailed test-writing rules — including the mandatory 3A pattern, mock factory structure,
> Observable testing, forbidden patterns, and the full spec-plan → `.spec.ts` workflow — are
> defined in **Skill: `test-case-writing`** (`.agents/skills/test-case-writing/SKILL.md`).
> Load that skill before implementing any test file.
