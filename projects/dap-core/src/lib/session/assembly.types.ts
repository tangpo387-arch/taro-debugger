import { DapDisassembledInstruction } from '../dap.types';

/**
 * A contiguous block of cached, enhanced disassembled instructions.
 *
 * `start` and `end` are derived from the embedded `instructions` array:
 * - `start` = `instructions[0].address`
 * - `end`   = `instructions.last.address + instructionByteLength - 1`
 *
 * Instructions MUST be stored in strictly ascending address order with no gaps.
 * Used internally by DapAssemblyCacheService for spatial lookup and LRU pruning.
 */
export interface CachedRange {
  /** Absolute address (as bigint) of the first instruction in the range. */
  start: bigint;
  /** Inclusive byte-end address (as bigint) of the last instruction in the range. */
  end: bigint;
  /** Instructions sorted ascending by address. No address gaps within this array. */
  instructions: DapDisassembledInstruction[];
}
