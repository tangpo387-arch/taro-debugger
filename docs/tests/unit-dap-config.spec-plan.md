---
title: DapConfigService — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/dap-core/src/lib/session/dap-config.service.ts
related-wi: ~
last_updated: 2026-04-21
---

# DapConfigService — Unit Spec Plan

## Overview

Fully isolated tests for `DapConfigService`. Focuses on config state access,
localStorage persistence, and error resilience during initialization.

---

## Test Cases

### Suite: `DapConfigService`

#### initialization-test

Scenario: should be created with default config

- Instantiate the service with a clean `localStorage`.
- Assert `serverAddress` defaults to `'localhost:4711'`.
- Assert `transportType` defaults to `'websocket'`.
- Assert `launchMode` defaults to `'launch'`.

---

#### api-test

Scenario: should set and get config correctly

- Call `setConfig(mockConfig)`.
- Assert `getConfig()` deeply equals `mockConfig`.
- Assert the returned object is a **defensive copy** (not the same reference as `mockConfig`).

---

#### persistence-test

Scenario: should persist config to localStorage when setConfig is called

- Call `setConfig(mockConfig)`.
- Assert `localStorage.getItem('taro_dap_config')` is truthy.
- Assert it round-trips back to the original config via `JSON.parse`.

Scenario: should load config from localStorage on initialization

- Pre-seed `localStorage` with a serialized `mockConfig`.
- Construct a new `DapConfigService` instance.
- Assert `getConfig()` equals `mockConfig`.

---

#### error-test

Scenario: should handle invalid JSON in localStorage gracefully

- Pre-seed `localStorage` with a non-JSON string.
- Spy on `console.error`.
- Construct a new `DapConfigService` instance.
- Assert `serverAddress` falls back to default `'localhost:4711'`.
- Assert `console.error` was called exactly once.

Scenario: should merge defaults with partial stored config

- Pre-seed `localStorage` with only `{ serverAddress, launchMode }`.
- Construct a new `DapConfigService` instance.
- Assert stored fields (`serverAddress`, `launchMode`) override defaults.
- Assert unspecified fields (`transportType`, `executablePath`) retain their default values.
