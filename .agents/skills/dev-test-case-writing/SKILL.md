---
name: "[DEV:TEST] Test Case Writing"
description: Step-by-step workflow for translating a spec-plan file into a production-ready Vitest .spec.ts file, covering TestBed setup, mock patterns, Angular service and component test structures, and assertion conventions.
---

# Test Case Writing Skill

## 1. When to Use This Skill

You **MUST** load this skill before performing any of the following tasks:

- Writing a new `*.spec.ts` file from a `docs/tests/*.spec-plan.md`
- Reviewing an existing `*.spec.ts` for structural correctness
- Extending an existing test suite with additional test cases

## 2. Applicable Roles

- **Lead_Engineer**: Must read before implementing any test file.
- **Quality_Control_Reviewer**: Must read before reviewing test implementations to ensure structural and mock-pattern compliance.

---

## 3. Mandatory Pre-Work: Read the Spec-Plan

Before writing a single line of test code, you **MUST**:

1. Identify the target module (e.g., `DapSessionService`, `FileExplorerComponent`).
2. Open the matching `docs/tests/*.spec-plan.md` file.
3. Read every test case description in full.
4. If the task involves adding **new** test cases not found in the spec-plan, you **MUST first** (or simultaneously) update the `docs/tests/*.spec-plan.md` to reflect these cases.
5. Map each **bold heading** in the spec-plan to an `it('...', ...)` block in the `.spec.ts`.

> [!IMPORTANT]
> The `it()` description string must faithfully reflect the spec-plan heading.
> Example: spec-plan `**Cache hit (single request)**` → `it('should resolve from cache on second call without a DAP round-trip', ...)`

---

## 4. Workflow: Spec-Plan → `.spec.ts`

```text
Step 1  Read/Update spec-plan → enumerate test cases
Step 2  Choose template (Service or Component — see §5)
Step 3  Configure TestBed / mock factory
Step 4  Implement each it() block using the 3A pattern (Arrange / Act / Assert)
Step 5  Verify no cross-test state leakage (use beforeEach / afterEach)
Step 6  Confirm that the .spec.ts content reflects 100% of the spec-plan cases
```

---

## 5. Template Selection

| Target Type | Template to Use | Key Setup |
| :--- | :--- | :--- |
| Angular Service | `examples/service.spec.example.ts` | `TestBed.configureTestingModule` with provider overrides |
| Angular Component | `examples/component.spec.example.ts` | `TestBed.configureTestingModule` with `imports` (Standalone), fixture, `detectChanges` |
| DAP Transport layer | `examples/transport-mock.example.ts` | `Subject`-based transport mock; use only when testing `DapSessionService` itself |

---

## 6. Structural Rules

### 6.1 File & Suite Layout

```typescript
// One top-level describe per class under test
describe('ClassName', () => {
  // One nested describe per logical group (matches spec-plan section heading)
  describe('methodName()', () => {
    it('should ...', async () => { /* 3A */ });
  });
});
```

### 6.2 The 3A Pattern (Mandatory)

Every `it()` block must follow Arrange → Act → Assert order with a blank line separating each phase:

```typescript
it('should return cached content on second call', async () => {
  // Arrange
  mockSession.sendRequest.mockResolvedValue({ success: true, body: { content: 'hello' } });

  // Act
  await service.readFile('/src/main.cpp');
  await service.readFile('/src/main.cpp');

  // Assert
  expect(mockSession.sendRequest).toHaveBeenCalledTimes(1);
});
```

### 6.3 Mock Factory Pattern (Services)

Always define mocks via a factory function (not inline objects) to guarantee isolation across tests:

```typescript
function makeMockDapSession(overrides: Partial<DapSessionService> = {}) {
  return {
    sendRequest: vi.fn(),
    onEvent: vi.fn().mockReturnValue(EMPTY),
    executionState$: new BehaviorSubject('idle'),
    ...overrides,
  };
}
```

### 6.4 Observable Testing

Convert Observables to Promises for inline assertions:

```typescript
import { firstValueFrom } from 'rxjs';

const result = await firstValueFrom(service.scopes$);
expect(result).toEqual([]);
```

### 6.5 Async Cleanup

Use `takeUntilDestroyed` in production code; in tests, verify subscription teardown via spy:

```typescript
it('should cancel long-running Observable on component destroy', async () => {
  // Arrange — use a never-completing Observable to simulate an in-flight request
  const never$ = new Observable(() => { /* never completes */ });
  mockSession.getTree = vi.fn().mockReturnValue(never$);
  component.reloadTrigger = 1;
  fixture.detectChanges(); // triggers subscription

  // Act
  fixture.destroy(); // triggers ngOnDestroy / takeUntilDestroyed

  // Assert — verify no error is thrown and the subscription is cleaned up
  expect(() => fixture.destroy()).not.toThrow();
  // For services: spy on the destroy subject if accessible
  // expect(destroySubject.isStopped).toBe(true);
});
```

---

## 7. Forbidden Patterns

| Pattern | Why Forbidden |
| :--- | :--- |
| `npx vitest` or direct binary test execution | Bypasses Angular TestBed infrastructure; causes `initTestEnvironment` errors. You MUST use the `npm run test` pattern. |
| Shared mutable state between `it()` blocks | Causes order-dependent flakiness |
| `expect` outside `it()` | Silently passes on runner errors |
| Manual `subscribe()` without teardown in tests | Memory leak; may bleed into subsequent tests |
| `setTimeout` / `setInterval` in tests without `vi.useFakeTimers()` | Non-deterministic timing |
| `console.log` left in committed test code | Pollutes CI output |
| `Overwrite: true` on an existing `*.spec.ts` without prior audit | High risk of silently dropping existing test cases; git history provides no recoverable diff |

---

## 8. Cross-Reference

| Resource | Purpose |
| :--- | :--- |
| `examples/transport-mock.example.ts` | Subject-based mock for testing `DapSessionService` via raw DAP message injection |
| `docs/test-plan.md` | Master index of all spec-plan files |
| `docs/tests/*.spec-plan.md` | Per-module test case specifications |

---

## 9. Pre-Rewrite Audit Protocol (Mandatory)

If structural refactoring makes a full spec rewrite unavoidable, you **MUST** complete this checklist **before** using `Overwrite: true` on any existing `*.spec.ts`:

```bash
# Step 1 — List every existing test case from git HEAD
git show HEAD:<path-to-spec-file> | grep "it('"

# Step 2 — List every test case in your new draft
grep "it('" <path-to-spec-file>

# Step 3 — Diff the two lists and confirm zero omissions before committing
```

> [!CAUTION]
> Skipping this audit is what caused Windows-path, content-field, empty-string, and error-propagation tests to be silently dropped during a prior rewrite. A missing test case leaves a production code branch permanently uncovered without any visible warning.
