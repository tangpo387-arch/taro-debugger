import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DapSessionService } from './dap-session.service';
import { DapDisassembledInstruction, DisassembleArguments } from './dap.types';

@Injectable()
export class DapAssemblyService {
  private readonly sessionService = inject(DapSessionService);

  private readonly instructionsSubject = new BehaviorSubject<DapDisassembledInstruction[]>([]);
  public readonly instructions$: Observable<DapDisassembledInstruction[]> = this.instructionsSubject.asObservable();

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
      
      this.instructionsSubject.next(instructions);
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
