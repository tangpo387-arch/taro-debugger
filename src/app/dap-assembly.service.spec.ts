import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapAssemblyService } from './dap-assembly.service';
import { DapSessionService } from './dap-session.service';

/** Builds a minimal mock DAP disassemble response. */
function makeDisassembleResponse(instructions: { address: string; instruction: string }[]) {
  return { success: true, body: { instructions } };
}

describe('DapAssemblyService', () => {
  let service: DapAssemblyService;
  let mockDapSession: any;

  beforeEach(() => {
    mockDapSession = {
      disassemble: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DapAssemblyService,
        { provide: DapSessionService, useValue: mockDapSession },
      ],
    });

    service = TestBed.inject(DapAssemblyService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with an empty instructions$ observable', async () => {
    const instructions = await firstValueFrom(service.instructions$);
    expect(instructions).toEqual([]);
  });

  describe('fetchInstructions', () => {
    it('should update instructions$ with the response when successful', async () => {
      const fakeInstructions = [
        { address: '0x1000', instruction: 'mov eax, 1' },
        { address: '0x1005', instruction: 'add eax, 2' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      await service.fetchInstructions('0x1000', 2);

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions).toEqual(fakeInstructions);
      expect(mockDapSession.disassemble).toHaveBeenCalledWith(expect.objectContaining({
        memoryReference: '0x1000',
        instructionCount: 2
      }));
    });

    it('should handle loading state correctly', async () => {
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([]));
      
      const loadingStates: boolean[] = [];
      service.isLoading$.subscribe(state => loadingStates.push(state));

      await service.fetchInstructions('0x1000');

      // Should be: false (init) -> true (start) -> false (end)
      expect(loadingStates).toEqual([false, true, false]);
    });

    it('should reset instructions$ to [] and rethrow on DAP error', async () => {
      const error = new Error('DAP disassemble failed');
      mockDapSession.disassemble.mockRejectedValue(error);

      await expect(service.fetchInstructions('0x1000')).rejects.toThrow('DAP disassemble failed');

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions).toEqual([]);
    });

    it('should do nothing and not call DAP if memoryReference is empty', async () => {
      await service.fetchInstructions('');
      expect(mockDapSession.disassemble).not.toHaveBeenCalled();
    });

    it('should emit isLoading$ = true while request is in-flight', async () => {
      // Create a deferred promise so we can read isLoading$ before the mock resolves.
      let resolveDeferred!: (value: any) => void;
      const deferred = new Promise(resolve => { resolveDeferred = resolve; });
      mockDapSession.disassemble.mockReturnValue(deferred);

      const loadingStates: boolean[] = [];
      service.isLoading$.subscribe(state => loadingStates.push(state));

      // Start fetch but do NOT await yet — the mock is still pending.
      const fetchPromise = service.fetchInstructions('0x1000');

      // At this point the request is in-flight; isLoading$ must be true.
      expect(loadingStates).toContain(true);

      // Resolve the mock and let the fetch complete.
      resolveDeferred({ success: true, body: { instructions: [] } });
      await fetchPromise;

      // After completion, isLoading$ must settle back to false.
      expect(loadingStates[loadingStates.length - 1]).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should reset instructions$ to []', async () => {
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([{ address: '0x1', instruction: 'nop' }]));
      await service.fetchInstructions('0x1');
      
      service.clear();

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions).toEqual([]);
    });
  });
});
