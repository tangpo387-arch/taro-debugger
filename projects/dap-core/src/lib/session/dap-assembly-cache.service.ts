import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DapSessionService } from './dap-session.service';
import { DapDisassembledInstruction, DisassembleArguments } from '../dap.types';
import { CachedRange } from './assembly.types';

/**
 * Session-layer service for managing a spatial, address-range-indexed cache
 * of disassembled instructions.
 *
 * Responsibilities (Session Layer):
 * - Fetch disassembled instructions from the DAP adapter via DapSessionService.
 * - Cache results in self-contained CachedRange objects, each storing a sorted
 *   instruction array. No global Map or sortedAddresses index is maintained.
 * - Perform gap-filling: return cached instructions and only fetch missing ones.
 * - Perform spatial pruning (LRU by distance from IP) when the cache is full.
 * - Enhance raw DAP instructions with normalized symbol metadata.
 * - Clear the cache on relevant session lifecycle events.
 *
 * This service is NOT responsible for:
 * - UI stream management or sliding window logic (owned by the UI layer).
 * - Viewport scrolling events or infinite scroll orchestration.
 */
@Injectable()
export class DapAssemblyCacheService implements OnDestroy {
  private readonly sessionService = inject(DapSessionService);

  // ── Cache State ──────────────────────────────────────────────────────────
  /** Non-overlapping merged cached ranges, sorted by start address. Each range
   *  embeds its own instruction array — no global Map or sorted address index. */
  private cachedRanges: CachedRange[] = [];
  /** Last known instruction pointer address, used as reference for pruning. */
  private currentIpRef: bigint | null = null;

  private CACHE_LIMIT = 20000;
  private WATERMARK = 15000;

  /** Maximum number of cached instructions to "discount" from a new fetch request.
   *  Capping this ensures we always over-fetch a minimum amount to fill the cache
   *  and avoid continuous small requests during scrolling. */
  private static readonly MAX_CACHE_HIT_DISCOUNT = 1000;

  private sessionSubscription?: Subscription;

  constructor() {
    this.initSessionSync();
  }

  /** @internal For testing only — override cache size thresholds. */
  public setCacheLimits(limit: number, watermark: number): void {
    this.CACHE_LIMIT = limit;
    this.WATERMARK = watermark;
  }

  private initSessionSync(): void {
    this.sessionSubscription = this.sessionService.onEvent().subscribe(event => {
      if (event.event === 'terminated' || event.event === 'exited' || event.event === 'module') {
        this.clear();
      }
    });
  }

  ngOnDestroy(): void {
    this.sessionSubscription?.unsubscribe();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetches a contiguous block of enhanced instructions starting at `startAddr`.
   *
   * Uses the cache where possible (gap-filling strategy):
   * 1. Check the cache for a contiguous block starting at `startAddr`.
   * 2. If the cache covers the full requested `instructionCount`, return from
   *    cache without issuing a DAP request.
   * 3. Otherwise, fetch only the missing suffix from the DAP adapter and merge
   *    the result into the cache.
   *
   * @param startAddr       Absolute instruction address as bigint.
   * @param instructionCount Total instructions desired in the returned block.
   * @param instructionOffset Instruction offset applied when a DAP request is needed.
   * @returns Enhanced instruction array (may be combined from cache + DAP).
   */
  public async fetchInstructions(
    startAddr: bigint,
    instructionCount: number,
    instructionOffset: number
  ): Promise<DapDisassembledInstruction[]> {

    this.currentIpRef = startAddr;
    const memRefStr = `0x${startAddr.toString(16)}`;

    // Cache check: try to satisfy the full request from local store.
    let cachedInstructions: DapDisassembledInstruction[] = [];
    cachedInstructions = this.getFromCache(startAddr, instructionCount, instructionOffset);
    if (cachedInstructions.length === instructionCount) {
      return cachedInstructions;
    }

    // Partial / miss: fetch only the gap from the DAP adapter.
    const actualOffset = instructionOffset + cachedInstructions.length;
    const actualCount = instructionCount - Math.min(DapAssemblyCacheService.MAX_CACHE_HIT_DISCOUNT, cachedInstructions.length);

    let negInstructions: DapDisassembledInstruction[] = [];
    let gapInstructions: DapDisassembledInstruction[] = [];
    let posInstructions: DapDisassembledInstruction[] = [];

    // [IMPORTANT] Never use negative instructionOffset as some DAP adapters do not support it.
    // If actualOffset < 0, we compute a preceding memory reference using byte math and
    // split the request to ensure alignment at the PC reference.
    if (actualOffset < 0) {
      const negCount = Math.abs(actualOffset);
      const posCount = actualCount > negCount ? actualCount - negCount : 0;

      // ── Neg leg (instructions before PC) ─────────────────────────────────
      // Virtual base address for placeholder rows: walk back negCount slots from PC.
      const negVirtualBase = startAddr - BigInt(negCount);
      try {
        // Assume max ~4 bytes per instruction + padding, over-fetch slightly
        const guessBytes = BigInt(negCount * 4 + 32);
        const fallbackRef = `0x${(startAddr - guessBytes).toString(16)}`;
        const negRes = await this.sessionService.disassemble({
          memoryReference: fallbackRef,
          instructionCount: negCount + 10, // over-fetch to ensure overlap with PC
          instructionOffset: 0,
          resolveSymbols: true
        }, true);

        negInstructions = negRes.body?.instructions || [];
      } catch (negErr) {
        // Neg request failed — fill this half with error hints.
        negInstructions = this.buildErrorHintInstructions(negVirtualBase, negCount, negErr);
      }

      // ── Pos leg (instructions at/after PC) ────────────────────────────────
      if (posCount > 0) {
        try {
          const posRes = await this.sessionService.disassemble({
            memoryReference: memRefStr,
            instructionCount: posCount,
            instructionOffset: 0,
            resolveSymbols: true
          }, true);
          posInstructions = posRes.body?.instructions || [];
        } catch (posErr) {
          // Pos request failed — fill this half with error hints starting at PC.
          posInstructions = this.buildErrorHintInstructions(startAddr, posCount, posErr);
        }
      }

      // ── Fill Gap (if any) between Neg and Pos ─────────────────────────────
      if (negInstructions.length > 0 && posInstructions.length > 0) {
        const lastNeg = negInstructions[negInstructions.length - 1];
        const firstPos = posInstructions[0];

        const lastSize = lastNeg.instructionByteLength;
        let currentGapStart = lastNeg.address + BigInt(lastSize);

        // Iterate to fill the gap if one exists. Some adapters might not return
        // enough instructions in a single call to close the gap entirely.
        while (firstPos.address > currentGapStart && gapInstructions.length < 1000) {
          const byteDiff = Number(firstPos.address - currentGapStart);
          // Request enough instructions to cover the remaining byte difference.
          const guessCount = Math.min(1000, Math.max(1, byteDiff));

          try {
            const gapRes = await this.sessionService.disassemble({
              memoryReference: `0x${currentGapStart.toString(16)}`,
              instructionCount: guessCount,
              instructionOffset: 0,
              resolveSymbols: true
            }, true);

            const batch = (gapRes.body?.instructions || []).filter((inst: DapDisassembledInstruction) =>
              inst.address >= currentGapStart && inst.address < firstPos.address
            );

            if (batch.length === 0) break;

            gapInstructions.push(...batch);
            const lastInBatch = batch[batch.length - 1];
            const batchLastSize = lastInBatch.instructionByteLength;
            const nextStart = lastInBatch.address + BigInt(batchLastSize);

            if (nextStart <= currentGapStart) {
              // Ensure we always move forward at least one byte if size is unknown
              currentGapStart += BigInt(1);
            } else {
              currentGapStart = nextStart;
            }
          } catch (gapErr) {
            // Mark failure point with an error hint and stop filling this gap.
            gapInstructions.push(...(this.buildErrorHintInstructions(currentGapStart, 1, gapErr) as any[]));
            break;
          }
        }
      }

    } else {
      try {
        const response = await this.sessionService.disassemble({
          memoryReference: memRefStr,
          instructionCount: actualCount,
          instructionOffset: actualOffset,
          resolveSymbols: true
        }, true);
        posInstructions = response.body?.instructions || [];
      } catch (e) {
        // DAP adapter rejected the single disassemble request — fill with error hints.
        const virtualBase = startAddr + BigInt(actualOffset);
        posInstructions = this.buildErrorHintInstructions(virtualBase, actualCount, e);
      }
    }

    // Filter out duplicates and misaligned backward overlaps in a single pass.
    // By enforcing strict ascending order, we resolve overlaps caused by variable-length x86 instructions.
    const uniqueEnhanced: DapDisassembledInstruction[] = negInstructions;
    let maxAddr = BigInt(-1);
    if (negInstructions.length > 0) {
      const last = negInstructions[negInstructions.length - 1];
      maxAddr = last.address + BigInt(last.instructionByteLength);
    }
    for (const inst of gapInstructions) {
      if (inst.address > maxAddr) {
        maxAddr = inst.address;
        uniqueEnhanced.push(inst);
      }
    }
    for (const inst of posInstructions) {
      if (inst.address > maxAddr) {
        maxAddr = inst.address;
        uniqueEnhanced.push(inst);
      }
    }
    this.enhanceInstructions(uniqueEnhanced);

    // Persist new instructions to the cache.
    this.mergeBatchIntoRanges(uniqueEnhanced);
    this.pruneCache();

    // Combine and enforce strictly ascending order to ensure a clean continuous stream for the UI.
    // cachedInstructions is already a fresh array from getFromCache, so we can use it as our base.
    const finalResults = cachedInstructions;
    let maxFinalAddr = finalResults.length > 0
      ? (finalResults[finalResults.length - 1].address ?? BigInt(-1))
      : BigInt(-1);

    for (const inst of uniqueEnhanced) {
      if (inst.address > maxFinalAddr) {
        maxFinalAddr = inst.address;
        finalResults.push(inst);
      }
    }
    let centralIndex = finalResults.findIndex(inst => inst.address === startAddr);
    if (centralIndex === -1) {
      return finalResults.slice(0, instructionCount);
    }
    const startIndex = Math.max(0, instructionOffset + centralIndex);
    return finalResults.slice(startIndex, startIndex + instructionCount);
  }

  /**
   * Clears the entire instruction cache and resets all derived state.
   * Called on session lifecycle events (terminated, exited, module change).
   */
  public clear(): void {
    this.cachedRanges = [];
    this.currentIpRef = null;
  }

  // ── Error Recovery ────────────────────────────────────────────────────────

  /**
   * Builds a list of synthetic placeholder instructions when a DAP disassemble
   * request fails. Each placeholder occupies one virtual row in the assembly
   * view and carries a human-readable error hint so the UI is never left blank.
   *
   * @param baseAddr   Starting address for the synthetic block.
   * @param count      Number of placeholder rows to generate.
   * @param error      The caught error — its message is embedded in each row.
   * @returns          Array of `DapDisassembledInstruction` placeholders.
   */
  private buildErrorHintInstructions(
    baseAddr: bigint,
    count: number,
    error: unknown
  ): DapDisassembledInstruction[] {
    const message =
      error instanceof Error ? error.message : String(error);
    const hint = `; ${message}`;

    // Assign ascending virtual addresses so address-keyed maps never collide.
    return Array.from({ length: count }, (_, i) => ({
      address: baseAddr + BigInt(i),
      instruction: hint,
      instructionBytes: '0',
      instructionByteLength: 1,
      normalizedSymbol: '',
      byteOffset: undefined,
      isFunctionStart: false,
    }));
  }

  // ── Instruction Enhancement ──────────────────────────────────────────────

  /**
   * Enriches raw DAP instructions with normalized symbol metadata.
   *
   * For each instruction:
   * - Strips angle brackets and offset suffixes from the `symbol` field to
   *   produce a clean `normalizedSymbol`.
   * - Calculates the `byteOffset` from the start of the current function.
   * - Sets `isFunctionStart = true` on the first instruction of each function.
   */
  private enhanceInstructions(instructions: DapDisassembledInstruction[]) {
    let currentBaseSymbol = '';
    let currentBaseAddress = BigInt(0);

    for (const inst of instructions) {

      const rawSymbol = inst.symbol || '';
      let isFunctionStart = false;

      const addr = inst.address;
      // Strip angle brackets, operator suffixes, and offset component.
      let parsedOffset: number | undefined;
      let normalized = rawSymbol.replace(/<|>|\+.*$/g, '').trim();

      const offsetMatch = rawSymbol.match(/\+((?:0x)?[0-9a-fA-F]+)>?$/);
      if (offsetMatch) {
        try {
          const val = offsetMatch[1];
          parsedOffset = val.toLowerCase().startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10);
          if (isNaN(parsedOffset)) parsedOffset = undefined;
        } catch {
          parsedOffset = undefined;
        }
      }

      if (normalized && normalized !== currentBaseSymbol) {
        currentBaseSymbol = normalized;
        currentBaseAddress = parsedOffset !== undefined ? (addr - BigInt(parsedOffset)) : addr;
        isFunctionStart = true;
      } else if (!normalized || normalized === '') {
        normalized = currentBaseSymbol;
      }

      let byteOffset: number | undefined = parsedOffset;
      if (byteOffset === undefined && currentBaseAddress !== BigInt(0)) {
        const diff = addr - currentBaseAddress;
        if (diff >= BigInt(0) && diff < BigInt(1048576)) {
          byteOffset = Number(diff);
        }
      }

      inst.normalizedSymbol = normalized;
      inst.byteOffset = byteOffset;
      inst.isFunctionStart = isFunctionStart;
    }
  }


  // ── Cache Internals ──────────────────────────────────────────────────────

  /**
   * Looks up a contiguous instruction slice starting near `referenceAddr` from
   * the range-local instruction arrays. No global sorted index is consulted.
   *
   * @param referenceAddr  The anchor address (e.g. PC or viewport top).
   * @param count          Maximum number of instructions to return.
   * @param instructionOffset  Signed offset from referenceAddr index.
   */
  private getFromCache(referenceAddr: bigint, count: number, instructionOffset: number): DapDisassembledInstruction[] {
    const range = this.findRange(referenceAddr);
    if (!range) return [];

    const idx = this.binarySearchInstructions(range.instructions, referenceAddr);
    if (idx === -1) return [];

    const startIdx = idx + instructionOffset;
    if (startIdx < 0 || startIdx >= range.instructions.length) return [];

    return range.instructions.slice(startIdx, startIdx + count);
  }

  /**
   * Finds the single CachedRange whose [start, end] interval contains `addr`.
   * Since cachedRanges is kept sorted by start, a linear scan suffices for the
   * typical case of <10 ranges; a binary search can be substituted if needed.
   */
  private findRange(addr: bigint): CachedRange | undefined {
    for (const range of this.cachedRanges) {
      if (addr >= range.start && addr <= range.end) return range;
      if (range.start > addr) break; // Sorted — no point continuing.
    }
    return undefined;
  }

  /**
   * Binary-searches a sorted DapDisassembledInstruction[] for the given address.
   * @returns Index of the matching instruction, or -1 if not found.
   */
  private binarySearchInstructions(instructions: DapDisassembledInstruction[], target: bigint): number {
    let left = 0;
    let right = instructions.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (instructions[mid].address === target) return mid;
      if (instructions[mid].address < target) left = mid + 1;
      else right = mid - 1;
    }
    return -1;
  }

  /**
   * Merges a newly fetched, enhanced batch of instructions into `cachedRanges`.
   *
   * Steps:
   * 1. Derive start/end from the batch's first and last instruction.
   * 2. Binary-insert a new CachedRange into the sorted cachedRanges array.
   * 3. Merge any overlapping or adjacent ranges by concatenating their
   *    instruction arrays (ascending-order filter applied to de-duplicate).
   *
   * Complexity: O(K + M) — no global sort over the full cache.
   */
  private mergeBatchIntoRanges(batch: DapDisassembledInstruction[]): void {
    if (batch.length === 0) return;

    const firstInst = batch[0];
    const lastInst = batch[batch.length - 1];
    const lastSize = lastInst.instructionByteLength;

    const newRange: CachedRange = {
      start: firstInst.address,
      end: lastInst.address + BigInt(lastSize - 1),
      instructions: batch,
    };

    // Binary-insert into sorted cachedRanges by start address.
    let insertIdx = this.cachedRanges.length;
    for (let i = 0; i < this.cachedRanges.length; i++) {
      if (this.cachedRanges[i].start >= newRange.start) {
        insertIdx = i;
        break;
      }
    }
    this.cachedRanges.splice(insertIdx, 0, newRange);

    // Merge overlapping or adjacent ranges in a single forward pass.
    if (this.cachedRanges.length > 1) {
      let writeIdx = 0;
      for (let i = 1; i < this.cachedRanges.length; i++) {
        const current = this.cachedRanges[writeIdx];
        const next = this.cachedRanges[i];

        if (next.start <= current.end + BigInt(1)) {
          // Ranges overlap or are adjacent — merge instructions and update end.
          const merged = current.instructions.slice();
          let maxMergeAddr = merged.length > 0 ? merged[merged.length - 1].address : BigInt(-1);
          for (const inst of next.instructions) {
            if (inst.address > maxMergeAddr) {
              maxMergeAddr = inst.address;
              merged.push(inst);
            }
          }
          current.instructions = merged;
          current.end = current.end > next.end ? current.end : next.end;
        } else {
          writeIdx++;
          this.cachedRanges[writeIdx] = next;
        }
      }
      this.cachedRanges.length = writeIdx + 1;
    }
  }

  /**
   * Returns the total number of cached instructions across all ranges.
   */
  private get totalCachedCount(): number {
    return this.cachedRanges.reduce((sum, r) => sum + r.instructions.length, 0);
  }

  /**
   * Evicts the range(s) furthest from the current IP until the cache falls
   * to the WATERMARK threshold.
   */
  private pruneCache(): void {
    if (this.totalCachedCount <= this.CACHE_LIMIT) return;

    const ip = this.currentIpRef ?? BigInt(0);

    const rangeDistances = this.cachedRanges.map(range => {
      const dStart = ip > range.start ? ip - range.start : range.start - ip;
      const dEnd = ip > range.end ? ip - range.end : range.end - ip;
      return { range, distance: dStart < dEnd ? dStart : dEnd };
    });

    // Sort descending — furthest ranges evicted first.
    rangeDistances.sort((a, b) => (a.distance > b.distance ? -1 : 1));

    while (this.totalCachedCount > this.WATERMARK && rangeDistances.length > 1) {
      const furthest = rangeDistances.shift();
      if (furthest) {
        this.cachedRanges = this.cachedRanges.filter(r => r !== furthest.range);
      }
    }
  }
}
