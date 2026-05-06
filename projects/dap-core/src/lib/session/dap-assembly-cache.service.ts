import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DapSessionService } from './dap-session.service';
import { DapDisassembledInstruction, DisassembleArguments } from '../dap.types';
import { TaroDisassembledInstruction, CachedRange } from './assembly.types';

/**
 * Session-layer service for managing a spatial, address-range-indexed cache
 * of disassembled instructions.
 *
 * Responsibilities (Session Layer):
 * - Fetch disassembled instructions from the DAP adapter via DapSessionService.
 * - Cache results in a Map keyed by normalized hex address.
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
  private readonly instructionCache = new Map<bigint, TaroDisassembledInstruction>();
  /** Sorted list of all cached instruction addresses for fast neighbor lookup. */
  private sortedAddresses: bigint[] = [];
  /** Non-overlapping merged cached ranges, sorted by start address. */
  private cachedRanges: CachedRange[] = [];
  /** Last known instruction pointer address, used as reference for pruning. */
  private currentIpRef: bigint | null = null;

  private CACHE_LIMIT = 20000;
  private WATERMARK = 15000;

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
   * Fetches a contiguous block of enhanced instructions starting at `memoryReference`.
   *
   * Uses the cache where possible (gap-filling strategy):
   * 1. If `memoryReference` is a hex address, check the cache for a contiguous
   *    block starting there.
   * 2. If the cache covers the full requested `instructionCount`, return from
   *    cache without issuing a DAP request.
   * 3. Otherwise, fetch only the missing suffix from the DAP adapter and merge
   *    the result into the cache.
   *
   * @param memoryReference Hex address string (e.g. '0x1000') or opaque reference.
   * @param instructionCount Total instructions desired in the returned block.
   * @param instructionOffset Instruction offset applied when a DAP request is needed.
   * @returns Enhanced instruction array (may be combined from cache + DAP).
   */
  public async fetchInstructions(
    memoryReference: bigint,
    instructionCount: number,
    instructionOffset: number
  ): Promise<TaroDisassembledInstruction[]> {
    if (!memoryReference) return [];

    // Resolve starting address when a hex reference is provided.
    const startAddr = memoryReference;
    this.currentIpRef = startAddr;
    const memRefStr = `0x${memoryReference.toString(16)}`;

    // Cache check: try to satisfy the full request from local store.
    let cachedInstructions: TaroDisassembledInstruction[] = [];
    if (startAddr !== null) {
      cachedInstructions = this.getFromCache(startAddr, instructionCount, instructionOffset);
      if (cachedInstructions.length === instructionCount) {
        return cachedInstructions;
      }
    }

    // Partial / miss: fetch only the gap from the DAP adapter.
    const actualOffset = instructionOffset + cachedInstructions.length;
    const actualCount = instructionCount - cachedInstructions.length;

    let rawInstructions: DapDisassembledInstruction[] = [];

    // [IMPORTANT] Split the request if we are fetching backwards across the PC reference to ensure 
    // the DAP adapter doesn't swallow the PC due to instruction misalignment.
    if (actualOffset < 0 && (actualOffset + actualCount) > 0) {
      const negCount = Math.abs(actualOffset);
      const posCount = actualCount - negCount;

      try {
        const [negRes, posRes] = await Promise.all([
          this.sessionService.disassemble({
            memoryReference: memRefStr,
            instructionCount: negCount,
            instructionOffset: actualOffset,
            resolveSymbols: true
          }),
          this.sessionService.disassemble({
            memoryReference: memRefStr,
            instructionCount: posCount,
            instructionOffset: 0,
            resolveSymbols: true
          })
        ]);
        let negInstructions = negRes.body?.instructions || [];
        const posInstructions = posRes.body?.instructions || [];

        // Workaround for GDB DAP bug: if negative instructionOffset returns empty,
        // fallback to computing a preceding memory reference using byte math.
        if (negInstructions.length === 0 && negCount > 0) {
          try {
            // Assume max ~4 bytes per instruction + padding, over-fetch slightly
            const guessBytes = BigInt(negCount * 4 + 32);
            const fallbackRef = `0x${(startAddr - guessBytes).toString(16)}`;
            const fallbackRes = await this.sessionService.disassemble({
              memoryReference: fallbackRef,
              instructionCount: negCount + 10, // over-fetch to ensure overlap with PC
              instructionOffset: 0,
              resolveSymbols: true
            });
            negInstructions = fallbackRes.body?.instructions || [];
          } catch { /* Fallback failed, proceed with empty */ }
        }

        rawInstructions = [
          ...negInstructions,
          ...posInstructions
        ];
      } catch (e) {
        // Fallback to single request if adapter doesn't support concurrent requests well
        const response = await this.sessionService.disassemble({
          memoryReference: memRefStr,
          instructionCount: actualCount,
          instructionOffset: actualOffset,
          resolveSymbols: true
        });
        rawInstructions = response.body?.instructions || [];
      }
    } else {
      const response = await this.sessionService.disassemble({
        memoryReference: memRefStr,
        instructionCount: actualCount,
        instructionOffset: actualOffset,
        resolveSymbols: true
      });
      rawInstructions = response.body?.instructions || [];
    }

    const enhanced = this.enhanceInstructions(rawInstructions);

    // Deduplicate to prevent Angular ngFor trackBy errors from overlapping fetches
    const uniqueEnhanced: TaroDisassembledInstruction[] = [];
    const seen = new Set<bigint>();
    for (const inst of enhanced) {
      if (inst.address !== undefined && !seen.has(inst.address)) {
        seen.add(inst.address);
        uniqueEnhanced.push(inst);
      }
    }

    // Persist new instructions to the cache.
    for (const inst of uniqueEnhanced) {
      if (inst.address !== undefined)
        this.instructionCache.set(inst.address, inst);
    }
    this.updateSortedAddresses();
    this.updateCachedRanges(uniqueEnhanced);
    this.pruneCache();

    // Combine and deduplicate to ensure a clean continuous stream for the UI
    const merged = [...cachedInstructions, ...uniqueEnhanced];
    const finalResults: TaroDisassembledInstruction[] = [];
    const finalSeen = new Set<bigint>();

    for (const inst of merged) {
      if (inst.address !== undefined && !finalSeen.has(inst.address)) {
        finalSeen.add(inst.address);
        finalResults.push(inst);
      }
    }

    return finalResults.slice(0, instructionCount);
  }

  /**
   * Clears the entire instruction cache and resets all derived state.
   * Called on session lifecycle events (terminated, exited, module change).
   */
  public clear(): void {
    this.instructionCache.clear();
    this.cachedRanges = [];
    this.sortedAddresses = [];
    this.currentIpRef = null;
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
  private enhanceInstructions(instructions: DapDisassembledInstruction[]): TaroDisassembledInstruction[] {
    let currentBaseSymbol = '';
    let currentBaseAddress = BigInt(0);

    return instructions.map(inst => {
      const rawSymbol = inst.symbol || '';
      let isFunctionStart = false;

      const addr = inst.address;
      if (addr === undefined)
        return { ...inst, normalizedSymbol: '', byteOffset: undefined, isFunctionStart: false };

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

      return {
        ...inst,
        normalizedSymbol: normalized,
        byteOffset,
        isFunctionStart
      };
    });
  }

  // ── Cache Internals ──────────────────────────────────────────────────────

  private getFromCache(referenceAddr: bigint, count: number, instructionOffset: number = 0): TaroDisassembledInstruction[] {
    const idx = this.binarySearch(this.sortedAddresses, referenceAddr);
    if (idx === -1) return [];

    const startIdx = idx + instructionOffset;
    if (startIdx < 0 || startIdx >= this.sortedAddresses.length) return [];

    const result: TaroDisassembledInstruction[] = [];
    for (let i = startIdx; i < this.sortedAddresses.length && result.length < count; i++) {
      const inst = this.instructionCache.get(this.sortedAddresses[i]);
      if (inst) {
        result.push(inst);
      } else {
        break; // Gap detected — return the contiguous prefix only.
      }
    }
    return result;
  }

  private binarySearch(arr: bigint[], target: bigint): number {
    let left = 0;
    let right = arr.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid] === target) return mid;
      if (arr[mid] < target) left = mid + 1;
      else right = mid - 1;
    }
    return -1;
  }

  private updateSortedAddresses(): void {
    this.sortedAddresses = Array.from(this.instructionCache.keys())
      .sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
  }

  private updateCachedRanges(newInstructions: TaroDisassembledInstruction[]): void {
    if (newInstructions.length === 0) return;

    const start = newInstructions[0].address;
    const end = newInstructions[newInstructions.length - 1].address;
    if (start === undefined || end === undefined) return;

    this.cachedRanges.push({ start, end });

    // Sort then merge overlapping/adjacent ranges.
    this.cachedRanges.sort((a, b) => (a.start < b.start ? -1 : 1));

    const merged: CachedRange[] = [];
    let current = this.cachedRanges[0];
    for (let i = 1; i < this.cachedRanges.length; i++) {
      const next = this.cachedRanges[i];
      if (next.start <= current.end) {
        current.end = current.end > next.end ? current.end : next.end;
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
    this.cachedRanges = merged;
  }

  /**
   * Evicts the range(s) furthest from the current IP until the cache falls
   * to the WATERMARK threshold.
   */
  private pruneCache(): void {
    if (this.instructionCache.size <= this.CACHE_LIMIT) return;

    const ip = this.currentIpRef ?? BigInt(0);

    const rangeDistances = this.cachedRanges.map(range => {
      const dStart = ip > range.start ? ip - range.start : range.start - ip;
      const dEnd = ip > range.end ? ip - range.end : range.end - ip;
      return { range, distance: dStart < dEnd ? dStart : dEnd };
    });

    // Sort descending — furthest ranges evicted first.
    rangeDistances.sort((a, b) => (a.distance > b.distance ? -1 : 1));

    while (this.instructionCache.size > this.WATERMARK && rangeDistances.length > 1) {
      const furthest = rangeDistances.shift();
      if (furthest) {
        this.evictRange(furthest.range);
        this.cachedRanges = this.cachedRanges.filter(r => r !== furthest.range);
      }
    }
  }

  private evictRange(range: CachedRange): void {
    for (const [addr] of this.instructionCache.entries()) {
      if (addr >= range.start && addr <= range.end) {
        this.instructionCache.delete(addr);
      }
    }
  }
}
