import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DapAssemblyCacheService, TaroDisassembledInstruction } from '@taro/dap-core';

// Re-export so existing consumers (e.g. AssemblyViewComponent) need no import changes.
export type { TaroDisassembledInstruction };

/**
 * UI-layer service for the Assembly View.
 *
 * Responsibilities (UI Layer):
 * - Maintain the `instructions$` stream exposed to AssemblyViewComponent.
 * - Manage the sliding window (dropping stale items to keep the virtual scroll
 *   list at a bounded size and prevent DOM/memory bloat).
 * - Orchestrate infinite scroll by calling DapAssemblyCacheService when the
 *   viewport approaches the top or bottom boundary.
 * - Reflect loading state via `isLoading$`.
 *
 * Delegates all caching, gap-filling, pruning, and instruction enhancement
 * to DapAssemblyCacheService (Session Layer).
 */
@Injectable()
export class DapAssemblyService implements OnDestroy {
  private readonly cacheService = inject(DapAssemblyCacheService);

  private readonly instructionsSubject = new BehaviorSubject<TaroDisassembledInstruction[]>([]);
  public readonly instructions$: Observable<TaroDisassembledInstruction[]> = this.instructionsSubject.asObservable();

  private readonly currentPcSubject = new BehaviorSubject<string | null>(null);
  /** Observable stream of the current Program Counter (PC) address. */
  public readonly currentPc$ = this.currentPcSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  public readonly isLoading$: Observable<boolean> = this.loadingSubject.asObservable();

  // ── Sliding Window Config ────────────────────────────────────────────────
  private readonly UI_WINDOW_LIMIT = 20000;
  private readonly UI_WINDOW_WATERMARK = 15000;
  private readonly AUTO_FETCH_THRESHOLD = 20;
  private readonly AUTO_FETCH_COUNT = 100;

  /** @internal For testing only */
  public setCacheLimits(limit: number, watermark: number): void {
    this.cacheService.setCacheLimits(limit, watermark);
  }

  ngOnDestroy(): void {
    // No subscriptions to clean up — DapAssemblyCacheService manages its own lifecycle.
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Sets the current Program Counter (PC) and automatically fetches a centered
   * instruction stream (+/- 1000 instructions) around this address.
   */
  public async setPC(pc: string): Promise<void> {
    if (!pc) return;
    this.currentPcSubject.next(pc);
    await this.relocateWindow(pc, 2001, -1000);
  }

  /**
   * Loads instructions centred on `memoryReference` into the UI stream.
   *
   * Fast-path: If the IP is already present in the current UI stream, skip the
   * fetch entirely (AssemblyViewComponent's infinite scroll will handle edges).
   */
  public async relocateWindow(
    memoryReference: string,
    instructionCount: number = 100,
    instructionOffset: number = 0
  ): Promise<void> {
    if (!memoryReference) return;

    // Fast-path: If we're already centered on this PC and instructions are visible, skip.
    const currentUI = this.instructionsSubject.value;
    const normalizedRef = this.normalizeAddress(memoryReference);
    if (currentUI.length > 0) {
      const found = currentUI.some(i => this.normalizeAddress(i.address) === normalizedRef);
      // If the request demands preceding instructions (instructionOffset < 0), we bypass the fast-path
      // to ensure the UI buffer is properly re-centered with sufficient backward context.
      if (found && instructionOffset >= 0) return;
    }

    this.loadingSubject.next(true);
    try {
      const instructions = await this.cacheService.fetchInstructions(memoryReference, instructionCount, instructionOffset);
      this.instructionsSubject.next(instructions);
    } catch (error) {
      this.instructionsSubject.next([]);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Triggered by the viewport scroll index changing.
   * Kicks off a silent background fetch when the rendered list approaches either edge.
   */
  public async onViewportScroll(index: number, viewportSize: number): Promise<void> {
    const current = this.instructionsSubject.value;
    if (current.length === 0 || this.loadingSubject.value) return;

    if (index + viewportSize >= current.length - this.AUTO_FETCH_THRESHOLD) {
      await this.fetchMore('forward');
    } else if (index <= this.AUTO_FETCH_THRESHOLD) {
      await this.fetchMore('backward');
    }
  }

  /**
   * Fetches additional instructions in the given direction and prepends/appends
   * to the UI stream. Applies a sliding window cap to bound the DOM list size.
   * This is a silent operation (no `isLoading$` state change) for smooth UX.
   */
  public async fetchMore(direction: 'forward' | 'backward'): Promise<void> {
    const current = this.instructionsSubject.value;
    if (current.length === 0 || this.loadingSubject.value) return;

    let ref: string;
    let instructionOffset: number;
    const count = this.AUTO_FETCH_COUNT;

    if (direction === 'forward') {
      ref = current[current.length - 1].address;
      instructionOffset = 1;
    } else {
      ref = current[0].address;
      instructionOffset = -count;
    }

    try {
      const newInsts = await this.cacheService.fetchInstructions(ref, count, instructionOffset);

      // Apply sliding window — drop from the opposite end to keep list bounded.
      let nextList: TaroDisassembledInstruction[];
      if (direction === 'forward') {
        nextList = [...current, ...newInsts];
        if (nextList.length > this.UI_WINDOW_LIMIT) {
          nextList = nextList.slice(nextList.length - this.UI_WINDOW_WATERMARK);
        }
      } else {
        nextList = [...newInsts, ...current];
        if (nextList.length > this.UI_WINDOW_LIMIT) {
          nextList = nextList.slice(0, this.UI_WINDOW_WATERMARK);
        }
      }
      this.instructionsSubject.next(nextList);
    } catch (error) {
      console.error('Auto-fetch failed', error);
    }
  }

  /** Clears the UI stream and the underlying cache. */
  public clear(): void {
    this.cacheService.clear();
    this.instructionsSubject.next([]);
    this.loadingSubject.next(false);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private normalizeAddress(addr: string | null | undefined): string {
    if (!addr) return '';
    const lower = addr.toLowerCase();
    if (lower.startsWith('0x')) {
      try {
        return BigInt(lower).toString(16);
      } catch { }
    }
    return lower.replace(/^0x/, '');
  }
}
