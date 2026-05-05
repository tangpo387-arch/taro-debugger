import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DapAssemblyCacheService, TaroDisassembledInstruction } from '@taro/dap-core';

// Re-export so existing consumers (e.g. AssemblyViewComponent) need no import changes.
export type { TaroDisassembledInstruction };
/**
 * Normalises a hex address string for reliable equality comparisons.
 * Strips the `0x` prefix, lowercases, trims whitespace, and collapses
 * leading zeros via BigInt so `0x00001000` === `0x1000`.
 */
export function normalizeAddress(addr: string | bigint | null | undefined): string {
  if (addr === null || addr === undefined) return '';
  if (typeof addr === 'bigint') return addr.toString(16);
  const lower = addr.toLowerCase().trim();
  if (lower.startsWith('0x')) {
    try {
      return BigInt(lower).toString(16);
    } catch { }
  }
  return lower.replace(/^0x/, '').trim();
}

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

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  public readonly isLoading$: Observable<boolean> = this.loadingSubject.asObservable();

  // ── Sliding Window Config ────────────────────────────────────────────────
  private static readonly AUTO_FETCH_THRESHOLD = 20;
  private static readonly AUTO_FETCH_COUNT = 100;

  /** Number of instructions fetched when centering the viewport on a PC address. */
  public static readonly ASSEMBLY_WINDOW_SIZE = 2001;
  /** Instruction offset applied so the PC lands near the center of the window. */
  public static readonly ASSEMBLY_WINDOW_OFFSET = -1000;

  /** @internal For testing only */
  public setCacheLimits(limit: number, watermark: number): void {
    this.cacheService.setCacheLimits(limit, watermark);
  }

  ngOnDestroy(): void {
    // No subscriptions to clean up — DapAssemblyCacheService manages its own lifecycle.
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Loads instructions centred on `memoryReference` into the UI stream.
   *
   * Fast-path: If the IP is already present in the current UI stream, skip the
   * fetch entirely (AssemblyViewComponent's infinite scroll will handle edges).
   */
  public async relocateWindow(
    memoryReference: bigint,
    instructionCount: number = DapAssemblyService.ASSEMBLY_WINDOW_SIZE,
    instructionOffset: number = DapAssemblyService.ASSEMBLY_WINDOW_OFFSET
  ): Promise<void> {
    if (!memoryReference) return;

    // Fast-path: If we're already centered on this PC and instructions are visible, skip.
    const currentUI = this.instructionsSubject.value;
    const normalizedRef = normalizeAddress(memoryReference);
    if (currentUI.length > 0) {
      const found = currentUI.some(i => normalizeAddress(i.address) === normalizedRef);
      // If the request demands preceding instructions (instructionOffset < 0), we bypass the fast-path
      // to ensure the UI buffer is properly re-centered with sufficient backward context.
      if (found && instructionOffset >= 0) return;
    }

    this.loadingSubject.next(true);
    try {
      const instructions = await this.cacheService.fetchInstructions(memoryReference, instructionCount, instructionOffset);
      this.instructionsSubject.next(instructions);
    } catch (error: any) {
      this.instructionsSubject.next([]);
      console.error('[DapAssemblyService] relocateWindow failed:', error?.message ?? error);
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

    if (index + viewportSize >= current.length - DapAssemblyService.AUTO_FETCH_THRESHOLD) {
      await this.fetchMore('forward');
    } else if (index <= DapAssemblyService.AUTO_FETCH_THRESHOLD) {
      await this.fetchMore('backward');
    }
  }

  /**
   * Fetches additional instructions in the given direction and prepends/appends
   * to the UI stream. Applies a sliding window cap to bound the DOM list size.
   * This is a silent operation (no `isLoading$` state change) for smooth UX.
   */
  private async fetchMore(direction: 'forward' | 'backward'): Promise<void> {
    const current = this.instructionsSubject.value;
    if (current.length === 0 || this.loadingSubject.value) return;

    let ref: bigint;
    let instructionOffset: number;
    const count = DapAssemblyService.AUTO_FETCH_COUNT;

    if (direction === 'forward') {
      const last = current[current.length - 1].address;
      ref = typeof last === 'bigint' ? last : BigInt(`0x${normalizeAddress(last)}`);
      instructionOffset = 1;
    } else {
      const first = current[0].address;
      ref = typeof first === 'bigint' ? first : BigInt(`0x${normalizeAddress(first)}`);
      instructionOffset = -count;
    }

    try {
      const newInsts = await this.cacheService.fetchInstructions(ref, count, instructionOffset);

      // Apply sliding window — drop from the opposite end to keep list bounded.
      let nextList: TaroDisassembledInstruction[];
      if (direction === 'forward') {
        nextList = [...current, ...newInsts];
        if (nextList.length > DapAssemblyService.ASSEMBLY_WINDOW_SIZE) {
          nextList = nextList.slice(-DapAssemblyService.ASSEMBLY_WINDOW_SIZE);
        }
      } else {
        nextList = [...newInsts, ...current];
        if (nextList.length > DapAssemblyService.ASSEMBLY_WINDOW_SIZE) {
          nextList = nextList.slice(DapAssemblyService.ASSEMBLY_WINDOW_SIZE);
        }
      }
      this.instructionsSubject.next(nextList);
    } catch (error) {
      console.error('Auto-fetch failed', error);
    }
  }


}
