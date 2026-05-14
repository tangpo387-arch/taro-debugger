---
title: Spec-Plan — DapAssemblyCacheService (Range-Embedded Storage)
scope: testing, unit, dap-core, assembly-cache
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-05-14
related:
  - docs/test-plan.md
  - docs/archive/specs/assembly-cache-range-refactor.md
  - docs/archive/specs/assembly-cache-spec.md
---

# Spec-Plan: `DapAssemblyCacheService` (Range-Embedded Storage)

> [!IMPORTANT]
> **Exclusion Boundaries**: These test cases target `DapAssemblyCacheService` only.
> They do not cover `AssemblyViewComponent` scroll behavior, `DapSessionService` state
> machine transitions, or transport-layer framing.
>
> The existing `dap-assembly-cache.service.spec.ts` covers the original 12 regression cases
> (cache hit, gap-fill, pruning, symbol enhancement, session lifecycle, overlap handling, clear).
> This spec-plan defines **additive** test cases that exercise properties specific to the
> WI-117 range-embedded storage model.

---

## Group A — `CachedRange` Structure Invariants

These tests assert that the internal `cachedRanges` array always satisfies the data model
contracts defined in WI-117: sorted by `start`, non-overlapping, and correctly carrying
`instructions` arrays.

### A1 — Single fetch produces exactly one CachedRange

**Scenario**: A single `fetchInstructions()` call that results in a DAP fetch.
**Assert**: After the call, exactly one `CachedRange` object exists internally.
**Assert**: `range.start` equals the address of the first returned instruction.
**Assert**: `range.end` equals `lastInst.address + instructionByteLength - 1`.
**Assert**: `range.instructions.length` matches the number of instructions returned.

### A2 — CachedRange instructions array is strictly ascending

**Scenario**: Fetch instructions that include a misaligned backward overlap (x86 variable-length).
**Assert**: Every `range.instructions[i].address < range.instructions[i+1].address`.
**Assert**: No duplicate addresses exist anywhere in the full `cachedRanges` collection.

### A3 — Two adjacent fetches collapse into a single CachedRange

**Scenario**: Fetch block `[0x1000, 0x1003]` (4-byte instruction), then fetch `[0x1004, 0x1007]`.
**Assert**: `cachedRanges.length === 1` after the second fetch.
**Assert**: The merged range covers `start=0x1000, end=0x1007`.
**Assert**: The merged `instructions` array contains all four instructions in address order.

### A4 — Two non-adjacent fetches remain separate CachedRange objects

**Scenario**: Fetch `[0x1000, 0x100F]`, then fetch `[0x2000, 0x200F]` (far jump).
**Assert**: `cachedRanges.length === 2`.
**Assert**: `cachedRanges[0].start === 0x1000n` and `cachedRanges[1].start === 0x2000n`.
**Assert**: Neither range's `instructions` array contains addresses from the other range.

---

## Group B — `findRange` / `getFromCache` Lookup Correctness

These tests verify that instruction lookups operate on per-range binary search and
do not consult any global sorted index.

### B1 — Cache hit returns slice from correct range when two ranges exist

**Scenario**: Prime cache with ranges `[0x1000, 0x100F]` and `[0x2000, 0x200F]`.
Request `getFromCache` (via `fetchInstructions` with no gap) for an address inside the second range.
**Assert**: The returned instructions are sourced exclusively from the second range.
**Assert**: `disassemble` is NOT called (full cache hit).

### B2 — instructionOffset applied within range boundary

**Scenario**: Cache a range of 10 instructions starting at `0x1000`.
Call `fetchInstructions(0x1004n, 3, 2)` (offset +2 from `0x1004`).
**Assert**: Returns 3 instructions starting from the instruction at index `baseIdx + 2`.
**Assert**: `disassemble` is NOT called.

### B3 — instructionOffset reaching beyond range end triggers a DAP fetch

**Scenario**: Cache a range with 5 instructions starting at `0x1000`.
Call `fetchInstructions(0x1000n, 5, 3)` (offset +3 would need index 8, beyond range end).
**Assert**: `disassemble` IS called (partial cache miss).

---

## Group C — `mergeBatchIntoRanges` — Merge Correctness

These tests verify that the single-pass merge procedure handles edge cases without a global sort.

### C1 — Overlapping new batch is de-duplicated during merge

**Scenario**: Cache `[0x1000, 0x1008]` (3 instructions). Fetch a batch that begins at `0x1006`
(overlapping 2 instructions with the existing range).
**Assert**: After merge, no address appears more than once in the merged range's `instructions`.
**Assert**: The merged `range.end` extends to cover the new batch's last instruction.

### C2 — Batch inserted in middle correctly splits no existing range

**Scenario**: Cache two ranges: `[0x1000, 0x100F]` and `[0x3000, 0x300F]`. Fetch a batch
at `[0x2000, 0x200F]`.
**Assert**: `cachedRanges.length === 3` (no spurious merges).
**Assert**: Ranges remain in ascending `start` order.

### C3 — Three-way merge: new batch bridges two existing ranges

**Scenario**: Cache `[0x1000, 0x1003]` and `[0x1008, 0x100B]`. Fetch batch `[0x1004, 0x1007]`
that exactly fills the gap.
**Assert**: `cachedRanges.length === 1` (all three collapse into one).
**Assert**: The single merged range spans `0x1000` to `0x100B + byteLength - 1`.

---

## Group D — `pruneCache` — Range-Level Eviction

These tests verify that pruning removes entire `CachedRange` objects and that no per-address
iteration occurs (testable by counting `cachedRanges.length`).

### D1 — Prune removes the single furthest range as a unit

**Scenario**: Set `CACHE_LIMIT=5, WATERMARK=3`. Fetch 5 instructions at `0x1000` (IP there).
Then fetch 2 instructions at `0x9000` (far away — triggers prune).
**Assert**: After the second fetch, `cachedRanges` no longer contains a range covering `0x1000`.
**Assert**: A subsequent `fetchInstructions(0x1000n, 1, 0)` calls `disassemble` (evicted).

### D2 — Prune preserves the range containing the current IP

**Scenario**: Set `CACHE_LIMIT=5, WATERMARK=3`. Fetch 3 instructions at `0x1000` (IP = `0x1000`),
then 3 instructions at `0x2000` (triggers prune, IP still `0x1000`).
**Assert**: The range covering `0x1000` is retained.
**Assert**: The range covering `0x2000` is evicted.

### D3 — Prune does not reduce below a single range

**Scenario**: Set `CACHE_LIMIT=2, WATERMARK=1`. Fetch 3 instructions in a single range.
**Assert**: After prune, `cachedRanges.length >= 1` (never fully emptied).

---

## Group E — `clear()` — Post-Clear State Guarantees

### E1 — clear() leaves cachedRanges as an empty array

**Scenario**: Fetch instructions to populate two ranges. Call `clear()`.
**Assert**: `cachedRanges.length === 0` (not just empty instructions, but no range objects).
**Assert**: A subsequent `fetchInstructions()` call re-issues `disassemble`.

---

## Group F — `assembly.types.ts` — CachedRange Schema

These tests assert the type contract at the data-model level.

### F1 — CachedRange object must include instructions property

**Scenario**: Programmatically create a `CachedRange` object without an `instructions` field
and pass it to the service (via `setCacheLimits` + indirect test).
**Assert**: TypeScript compiler (build-time check) rejects `{ start, end }` without `instructions`.
**Rationale**: This is a static typing test verified by the build, not a runtime Vitest case.
Document it here for traceability; confirm it via `npm run test:file` which invokes `tsc`.

---

## Implementation Notes

- **Target file**: `projects/dap-core/src/lib/session/dap-assembly-cache.service.spec.ts`
  (extend the existing file — do NOT create a separate file unless the suite exceeds 600 lines).
- **Mock pattern**: Reuse the existing `makeDisassembleResponse()` factory.
  Do not add a new factory without removing the old one.
- **Internal state access**: The `cachedRanges` field is `private`. To assert on its state,
  cast the service to `any` in test code only — never in production code.
- **Test run command**: `npm run test:file -- dap-core --include="**/dap-assembly-cache.service.spec.ts" --watch=false`
