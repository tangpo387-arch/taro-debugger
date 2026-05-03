import { DapDisassembledInstruction } from '../dap.types';

/**
 * An enhanced disassembled instruction with normalized symbol metadata.
 * Extends the raw DAP type with UI-friendly fields computed during enhancement.
 */
export interface TaroDisassembledInstruction extends DapDisassembledInstruction {
  /** Normalized function name (brackets, offsets, and angle-brackets stripped). */
  normalizedSymbol?: string;
  /** Byte offset of this instruction from the start of its function. */
  byteOffset?: number;
  /** True if this instruction is the entry point of its function. */
  isFunctionStart?: boolean;
}

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
