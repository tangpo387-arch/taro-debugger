import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { DapSessionService } from '@taro/dap-core';
import { DapDisassembledInstruction, DisassembleArguments } from '@taro/dap-core';

export interface TaroDisassembledInstruction extends DapDisassembledInstruction {
  normalizedSymbol?: string;
  byteOffset?: number;
  isFunctionStart?: boolean;
}

interface CachedRange {
  start: bigint; // Absolute address of first instruction
  end: bigint;   // Absolute address of last instruction
}

@Injectable()
export class DapAssemblyService implements OnDestroy {
  private readonly sessionService = inject(DapSessionService);

  private readonly instructionsSubject = new BehaviorSubject<TaroDisassembledInstruction[]>([]);
  public readonly instructions$: Observable<TaroDisassembledInstruction[]> = this.instructionsSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  public readonly isLoading$: Observable<boolean> = this.loadingSubject.asObservable();

  // ── Instruction Cache State ──────────────────────────────────────────
  private readonly instructionCache = new Map<string, TaroDisassembledInstruction>();
  /** Sorted list of all cached instruction addresses for fast neighbor lookup */
  private sortedAddresses: bigint[] = [];
  /** Sorted list of non-overlapping cached ranges */
  private cachedRanges: CachedRange[] = [];
  private currentIpRef: bigint | null = null;

  private CACHE_LIMIT = 20000;
  private WATERMARK = 15000;
  private readonly AUTO_FETCH_THRESHOLD = 20;
  private readonly AUTO_FETCH_COUNT = 100;

  private sessionSubscription?: Subscription;

  /** @internal For testing only */
  public setCacheLimits(limit: number, watermark: number): void {
    this.CACHE_LIMIT = limit;
    this.WATERMARK = watermark;
  }

  constructor() {
    this.initSessionSync();
  }

  private initSessionSync(): void {
    this.sessionSubscription = new Subscription();

    // Clear Trigger 1: terminated, disconnect, or module change
    this.sessionSubscription.add(
      this.sessionService.onEvent().subscribe(event => {
        if (event.event === 'terminated' || event.event === 'exited' || event.event === 'module') {
          this.clear();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sessionSubscription?.unsubscribe();
  }

  /**
   * Fetches assembly instructions from the DAP server, utilizing the cache where possible.
   * If part of the requested range is cached, it fetches only the missing instructions.
   */
  public async fetchInstructions(
    memoryReference: string,
    instructionCount: number = 100,
    offset: number = 0
  ): Promise<void> {
    if (!memoryReference) return;

    this.loadingSubject.next(true);
    try {
      // 1. Resolve starting address if possible (only if memoryReference is hex)
      let startAddr: bigint | null = null;
      if (memoryReference.startsWith('0x')) {
        try {
          startAddr = BigInt(memoryReference);
          this.currentIpRef = startAddr; // Update for pruning
        } catch { /* fallback to DAP */ }
      }

      // 1.5 Fast path for stepping (nexti/stepi)
      // If the IP is already in our UI stream, do nothing.
      // AssemblyViewComponent's infinite scroll will handle fetching more if we get near the edges.
      const currentUI = this.instructionsSubject.value;
      if (currentUI.length > 0) {
        const ipIndex = currentUI.findIndex(i => this.normalizeAddress(i.address) === this.normalizeAddress(memoryReference));
        if (ipIndex >= 0) {
          this.loadingSubject.next(false);
          return; // AssemblyViewComponent will handle the scroll smoothly
        }
      }

      // 2. Cache Check & Gap Identification
      let instructionsToReturn: TaroDisassembledInstruction[] = [];

      if (startAddr !== null) {
        instructionsToReturn = this.getFromCache(startAddr, instructionCount, offset);

        if (instructionsToReturn.length === instructionCount) {
          this.instructionsSubject.next(instructionsToReturn);
          this.loadingSubject.next(false);
          return;
        }
      }

      // 3. Fetch from DAP
      const actualOffset = offset + instructionsToReturn.length;
      const actualCount = instructionCount - instructionsToReturn.length;

      const args: DisassembleArguments = {
        memoryReference,
        instructionCount: actualCount,
        instructionOffset: actualOffset,
        resolveSymbols: true
      };

      const response = await this.sessionService.disassemble(args);
      const newInstructions: DapDisassembledInstruction[] = response.body?.instructions || [];

      // Pass 1: Normalize and Enhance
      const enhanced = this.enhanceInstructions(newInstructions);

      // Cache new instructions
      for (const inst of enhanced) {
        this.instructionCache.set(this.normalizeAddress(inst.address), inst);
      }
      this.updateSortedAddresses();
      this.updateCachedRanges(enhanced);
      this.pruneCache();

      // Combine cached and new
      const finalInstructions = [...instructionsToReturn, ...enhanced];
      this.instructionsSubject.next(finalInstructions);

    } catch (error) {
      this.instructionsSubject.next([]);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private enhanceInstructions(instructions: DapDisassembledInstruction[]): TaroDisassembledInstruction[] {
    let currentBaseSymbol = '';
    let currentBaseAddress = BigInt(0);

    return instructions.map(inst => {
      const rawSymbol = inst.symbol || '';
      let isFunctionStart = false;

      let addr: bigint;
      try {
        addr = BigInt(inst.address.startsWith('0x') ? inst.address : `0x${inst.address}`);
      } catch {
        addr = BigInt(0);
      }

      let parsedOffset: number | undefined = undefined;
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
        byteOffset: byteOffset,
        isFunctionStart
      };
    });
  }

  private getFromCache(referenceAddr: bigint, count: number, offset: number = 0): TaroDisassembledInstruction[] {
    const idx = this.binarySearch(this.sortedAddresses, referenceAddr);
    if (idx === -1) return [];

    const startIdx = idx + offset;
    // We can only return a contiguous block starting from startIdx.
    // If startIdx is not in the cache, we return nothing so it can be fetched.
    if (startIdx < 0 || startIdx >= this.sortedAddresses.length) {
      return [];
    }

    const result: TaroDisassembledInstruction[] = [];
    for (let i = startIdx; i < this.sortedAddresses.length && result.length < count; i++) {
      const addr = this.sortedAddresses[i];
      const inst = this.instructionCache.get(this.normalizeAddress(addr.toString(16)));
      if (inst) {
        result.push(inst);
      } else {
        break; // Gap found, return partial contiguous block
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
      .map(a => BigInt(`0x${a}`))
      .sort((a, b) => (a < b ? -1 : 1));
  }

  private normalizeAddress(addr: string | bigint | null | undefined): string {
    if (!addr) return '';
    if (typeof addr === 'bigint') {
      return addr.toString(16).toLowerCase();
    }
    const lower = addr.toLowerCase();
    if (lower.startsWith('0x')) {
      try {
        return BigInt(lower).toString(16);
      } catch { }
    }
    return lower.replace(/^0x/, '');
  }

  private updateCachedRanges(newInstructions: TaroDisassembledInstruction[]): void {
    if (newInstructions.length === 0) return;

    const start = this.parseAddress(newInstructions[0].address);
    const end = this.parseAddress(newInstructions[newInstructions.length - 1].address);

    const newRange: CachedRange = { start, end };
    this.cachedRanges.push(newRange);

    // Sort and merge
    this.cachedRanges.sort((a, b) => (a.start < b.start ? -1 : 1));

    const merged: CachedRange[] = [];
    if (this.cachedRanges.length > 0) {
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
    }
    this.cachedRanges = merged;
  }

  private parseAddress(addr: string): bigint {
    try {
      return BigInt(addr.startsWith('0x') ? addr : `0x${addr}`);
    } catch {
      return BigInt(0);
    }
  }

  private pruneCache(): void {
    if (this.instructionCache.size <= this.CACHE_LIMIT) return;

    const ip = this.currentIpRef || BigInt(0);

    const rangeDistances = this.cachedRanges.map(range => {
      const dStart = ip > range.start ? ip - range.start : range.start - ip;
      const dEnd = ip > range.end ? ip - range.end : range.end - ip;
      const distance = dStart < dEnd ? dStart : dEnd;
      return { range, distance };
    });

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
    for (const [addrStr, inst] of this.instructionCache.entries()) {
      const addr = this.parseAddress(inst.address);
      if (addr >= range.start && addr <= range.end) {
        this.instructionCache.delete(addrStr);
      }
    }
  }

  /**
   * Automatically triggered by the UI when the scroll position approaches the boundaries
   * of the currently loaded instructions.
   */
  public async onViewportScroll(index: number, viewportSize: number): Promise<void> {
    const current = this.instructionsSubject.value;
    if (current.length === 0 || this.loadingSubject.value) return;

    if (index + viewportSize >= current.length - this.AUTO_FETCH_THRESHOLD) {
      await this.fetchMore('forward');
    } else if (index <= this.AUTO_FETCH_THRESHOLD) {
      // Trigger backward fetch when near the top of the loaded list
      await this.fetchMore('backward');
    }
  }

  /**
   * Fetches more instructions in a specific direction and appends/prepends to the UI stream.
   * This is a silent operation (doesn't trigger loadingSubject) for smooth infinite scroll.
   */
  public async fetchMore(direction: 'forward' | 'backward'): Promise<void> {
    const current = this.instructionsSubject.value;
    if (current.length === 0 || this.loadingSubject.value) return;

    let ref: string;
    let offset: number;
    const count = this.AUTO_FETCH_COUNT;

    if (direction === 'forward') {
      ref = current[current.length - 1].address;
      offset = 1;
    } else {
      ref = current[0].address;
      offset = -count;
    }

    // SILENT fetch (no loading indicator)
    try {
      const args: DisassembleArguments = {
        memoryReference: ref,
        instructionCount: count,
        instructionOffset: offset,
        resolveSymbols: true
      };

      const response = await this.sessionService.disassemble(args);
      const newInsts = this.enhanceInstructions(response.body?.instructions || []);

      // Cache
      for (const inst of newInsts) {
        this.instructionCache.set(this.normalizeAddress(inst.address), inst);
      }
      this.updateSortedAddresses();
      this.updateCachedRanges(newInsts);
      this.pruneCache();

      // Update UI stream with sliding window logic if necessary
      let nextList: TaroDisassembledInstruction[];
      if (direction === 'forward') {
        nextList = [...current, ...newInsts];
        if (nextList.length > this.CACHE_LIMIT) {
          // Drop from top to stabilize scrollbar and memory
          nextList = nextList.slice(nextList.length - this.WATERMARK);
        }
      } else {
        nextList = [...newInsts, ...current];
        if (nextList.length > this.CACHE_LIMIT) {
          nextList = nextList.slice(0, this.WATERMARK);
        }
      }
      this.instructionsSubject.next(nextList);
    } catch (error) {
      console.error('Auto-fetch failed', error);
    }
  }

  public clear(): void {
    this.instructionCache.clear();
    this.cachedRanges = [];
    this.sortedAddresses = [];
    this.instructionsSubject.next([]);
    this.loadingSubject.next(false);
  }
}
