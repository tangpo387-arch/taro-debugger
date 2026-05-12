/**
 * An address range representing a contiguous block of cached instructions.
 * Used internally by DapAssemblyCacheService for spatial pruning.
 */
export interface CachedRange {
  /** Absolute address (as bigint) of the first instruction in the range. */
  start: bigint;
  /** Absolute address (as bigint) of the last instruction in the range. */
  end: bigint;
}
