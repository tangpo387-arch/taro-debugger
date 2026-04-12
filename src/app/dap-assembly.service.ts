import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DapSessionService } from './dap-session.service';
import { DapDisassembledInstruction, DisassembleArguments } from './dap.types';

export interface TaroDisassembledInstruction extends DapDisassembledInstruction {
  normalizedSymbol?: string;
  byteOffset?: number;
  isFunctionStart?: boolean;
}

@Injectable()
export class DapAssemblyService {
  private readonly sessionService = inject(DapSessionService);

  private readonly instructionsSubject = new BehaviorSubject<TaroDisassembledInstruction[]>([]);
  public readonly instructions$: Observable<TaroDisassembledInstruction[]> = this.instructionsSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  public readonly isLoading$: Observable<boolean> = this.loadingSubject.asObservable();

  /**
   * Fetches assembly instructions from the DAP server.
   * @param memoryReference The starting memory address or reference
   * @param instructionCount Number of instructions to fetch
   * @param offset Optional instruction offset
   */
  async fetchInstructions(
    memoryReference: string,
    instructionCount: number = 100,
    offset: number = 0
  ): Promise<void> {
    if (!memoryReference) return;

    this.loadingSubject.next(true);
    try {
      const args: DisassembleArguments = {
        memoryReference,
        instructionCount,
        instructionOffset: offset,
        resolveSymbols: true
      };

      const response = await this.sessionService.disassemble(args);
      const instructions: DapDisassembledInstruction[] = response.body?.instructions || [];

      // Pass 1: Normalize symbols and calculate offsets
      let currentBaseSymbol = '';
      let currentBaseAddress = BigInt(0);

      const enhancedInstructions: TaroDisassembledInstruction[] = instructions.map(inst => {
        const rawSymbol = inst.symbol || '';
        let isFunctionStart = false;
        
        // Use BigInt for 64-bit memory addresses
        let addr: bigint;
        try {
          addr = BigInt(inst.address.startsWith('0x') ? inst.address : `0x${inst.address}`);
        } catch {
          addr = BigInt(0);
        }

        // --- EXTRACT EXACT OFFSET FROM DAP SYMBOL ---
        // DAP often returns symbols like "<main+12>" or "main+0xc"
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
          // If DAP gave us the exact offset, we can mathematically calculate the TRUE base address!
          currentBaseAddress = parsedOffset !== undefined ? (addr - BigInt(parsedOffset)) : addr;
          isFunctionStart = true;
        } else if (!normalized || normalized === '') {
          normalized = currentBaseSymbol; // Inherit current context if no symbol provided
        }

        // --- CALCULATE FINAL OFFSET ---
        let byteOffset: number | undefined = parsedOffset;
        if (byteOffset === undefined && currentBaseAddress !== BigInt(0)) {
          const diff = addr - currentBaseAddress;
          // Only use large differences if they are reasonable (e.g. < 1MB)
          // otherwise it's likely a jump into padding or another section.
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

      this.instructionsSubject.next(enhancedInstructions);
    } catch (error) {
      // Reset the stream and rethrow — the UI layer is responsible for error display (R7).
      this.instructionsSubject.next([]);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Clears the current assembly state.
   */
  clear(): void {
    this.instructionsSubject.next([]);
    this.loadingSubject.next(false);
  }
}
