import { TestBed } from '@angular/core/testing';
import { firstValueFrom, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapAssemblyService, TaroDisassembledInstruction } from './dap-assembly.service';
import { DapAssemblyCacheService } from '@taro/dap-core';

/**
 * Typed accessor for DapAssemblyService private/internal members.
 *
 * Using a standalone interface (not `DapAssemblyService & {...}`) avoids the
 * TypeScript intersection-to-`never` collapse that occurs when you redeclare a
 * member that is `private` in the base class.  Cast once at setup via `unknown`;
 * all subsequent accesses through `svc` are fully type-checked.
 */
interface DapAssemblyServiceInternals {
  relocateWindow(ref: bigint, count: number, offset: number): Promise<void>;
  fetchMore(direction: 'forward' | 'backward'): Promise<void>;
  readonly instructionsSubject: BehaviorSubject<TaroDisassembledInstruction[]>;
  readonly loadingSubject: BehaviorSubject<boolean>;
  readonly instructions$: DapAssemblyService['instructions$'];
  readonly isLoading$: DapAssemblyService['isLoading$'];
}

describe('DapAssemblyService (UI Layer)', () => {
  let service: DapAssemblyService;
  /** Typed view of private members — cast once, used throughout all tests. */
  let svc: DapAssemblyServiceInternals;
  let mockCacheService: any;

  beforeEach(() => {
    mockCacheService = {
      fetchInstructions: vi.fn(),
      clear: vi.fn(),
      setCacheLimits: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DapAssemblyService,
        { provide: DapAssemblyCacheService, useValue: mockCacheService },
      ],
    });

    service = TestBed.inject(DapAssemblyService);
    svc = service as unknown as DapAssemblyServiceInternals;
  });

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── relocateWindow ────────────────────────────────────────────────────

  describe('relocateWindow', () => {
    it('should update instructions$ with data from the cache service', async () => {
      const fakeInstructions = [
        { address: BigInt('0x1000'), instruction: 'mov eax, 1' },
        { address: BigInt('0x1005'), instruction: 'add eax, 2' },
      ];
      mockCacheService.fetchInstructions.mockResolvedValue(fakeInstructions);

      await svc.relocateWindow(BigInt('0x1000'), 2, 0);

      const instructions = await firstValueFrom(svc.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[0].address).toBe(BigInt('0x1000'));
    });

    it('should skip the fetch entirely when the IP is already in the UI stream (fast-path)', async () => {
      // Arrange — seed the UI stream directly via the internal subject
      const existing = [{ address: BigInt('0x1000'), instruction: 'nop' }];
      svc.instructionsSubject.next(existing);

      // Act
      await svc.relocateWindow(BigInt('0x1000'), 1, 0);

      // Assert — no cache call expected
      expect(mockCacheService.fetchInstructions).not.toHaveBeenCalled();
    });

    it('should set isLoading$ to true while fetching, then false when done', async () => {
      let loadingDuringFetch = false;
      mockCacheService.fetchInstructions.mockImplementation(async () => {
        loadingDuringFetch = (await firstValueFrom(svc.isLoading$));
        return [];
      });

      await svc.relocateWindow(BigInt('0x1000'), 1, 0);

      expect(loadingDuringFetch).toBe(true);
      expect(await firstValueFrom(svc.isLoading$)).toBe(false);
    });

    it('should clear instructions$ and log when the cache service throws', async () => {
      mockCacheService.fetchInstructions.mockRejectedValue(new Error('DAP error'));

      // Should resolve (not reject) — errors are handled internally
      await expect(svc.relocateWindow(BigInt('0x1000'), 1, 0)).resolves.toBeUndefined();
      const instructions = await firstValueFrom(svc.instructions$);
      expect(instructions.length).toBe(0);
    });

    it('should pass offset parameter correctly to cache service', async () => {
      mockCacheService.fetchInstructions.mockResolvedValue([]);

      await svc.relocateWindow(BigInt('0x1000'), 200, -100);

      expect(mockCacheService.fetchInstructions).toHaveBeenCalledWith(BigInt('0x1000'), 200, -100);
    });
  });

  // ── fetchMore ────────────────────────────────────────────────────────────

  describe('fetchMore', () => {
    it('should append instructions forward and update the stream', async () => {
      const initial = [{ address: BigInt('0x1000'), instruction: 'nop' }];
      svc.instructionsSubject.next(initial);

      const newInsts = [{ address: BigInt('0x1004'), instruction: 'ret' }];
      mockCacheService.fetchInstructions.mockResolvedValue(newInsts);

      await svc.fetchMore('forward');

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[1].address).toBe(BigInt('0x1004'));
    });

    it('should prepend instructions backward and update the stream', async () => {
      const initial = [{ address: BigInt('0x1000'), instruction: 'nop' }];
      svc.instructionsSubject.next(initial);

      const newInsts = [{ address: BigInt('0x09F0'), instruction: 'prev' }];
      mockCacheService.fetchInstructions.mockResolvedValue(newInsts);

      await svc.fetchMore('backward');

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[0].address).toBe(BigInt('0x09F0'));
    });

    it('should use last address + offset=1 for forward fetch', async () => {
      svc.instructionsSubject.next([
        { address: BigInt('0x1000'), instruction: 'nop' },
        { address: BigInt('0x1008'), instruction: 'ret' },
      ]);
      mockCacheService.fetchInstructions.mockResolvedValue([]);

      await svc.fetchMore('forward');

      expect(mockCacheService.fetchInstructions).toHaveBeenCalledWith(BigInt('0x1008'), 100, 1);
    });

    it('should use first address + offset=-100 for backward fetch', async () => {
      svc.instructionsSubject.next([
        { address: BigInt('0x1000'), instruction: 'nop' },
      ]);
      mockCacheService.fetchInstructions.mockResolvedValue([]);

      await svc.fetchMore('backward');

      expect(mockCacheService.fetchInstructions).toHaveBeenCalledWith(BigInt('0x1000'), 100, -100);
    });

    it('should not fetch when stream is empty', async () => {
      await svc.fetchMore('forward');
      expect(mockCacheService.fetchInstructions).not.toHaveBeenCalled();
    });
  });

});
