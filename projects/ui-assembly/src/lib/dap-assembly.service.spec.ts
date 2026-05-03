import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapAssemblyService } from './dap-assembly.service';
import { DapAssemblyCacheService } from '@taro/dap-core';

describe('DapAssemblyService (UI Layer)', () => {
  let service: DapAssemblyService;
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
  });

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── setPC ───────────────────────────────────────────────────────────────

  describe('setPC', () => {
    it('should update currentPc$ and trigger a centered instruction fetch', async () => {
      mockCacheService.fetchInstructions.mockResolvedValue([]);

      await service.setPC('0x1000');

      expect(await firstValueFrom(service.currentPc$)).toBe('0x1000');
      expect(mockCacheService.fetchInstructions).toHaveBeenCalledWith('0x1000', 2001, -1000);
    });

    it('should skip fetching if the PC is null or empty', async () => {
      await service.setPC('');
      expect(mockCacheService.fetchInstructions).not.toHaveBeenCalled();
    });
  });

  // ── relocateWindow ────────────────────────────────────────────────────

  describe('relocateWindow', () => {
    it('should update instructions$ with data from the cache service', async () => {
      const fakeInstructions = [
        { address: '0x1000', instruction: 'mov eax, 1' },
        { address: '0x1005', instruction: 'add eax, 2' },
      ];
      mockCacheService.fetchInstructions.mockResolvedValue(fakeInstructions);

      await service.relocateWindow('0x1000', 2);

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[0].address).toBe('0x1000');
    });

    it('should skip the fetch entirely when the IP is already in the UI stream (fast-path)', async () => {
      // Seed the UI stream directly
      const existing = [{ address: '0x1000', instruction: 'nop' }];
      (service as any).instructionsSubject.next(existing);

      await service.relocateWindow('0x1000', 1);

      // No cache call expected
      expect(mockCacheService.fetchInstructions).not.toHaveBeenCalled();
    });

    it('should set isLoading$ to true while fetching, then false when done', async () => {
      let loadingDuringFetch = false;
      mockCacheService.fetchInstructions.mockImplementation(async () => {
        loadingDuringFetch = (await firstValueFrom(service.isLoading$));
        return [];
      });

      await service.relocateWindow('0x1000', 1);

      expect(loadingDuringFetch).toBe(true);
      expect(await firstValueFrom(service.isLoading$)).toBe(false);
    });

    it('should clear instructions$ and re-throw when the cache service throws', async () => {
      mockCacheService.fetchInstructions.mockRejectedValue(new Error('DAP error'));

      await expect(service.relocateWindow('0x1000', 1)).rejects.toThrow('DAP error');
      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(0);
    });

    it('should pass offset parameter correctly to cache service', async () => {
      mockCacheService.fetchInstructions.mockResolvedValue([]);
      await service.relocateWindow('0x1000', 200, -100);

      expect(mockCacheService.fetchInstructions).toHaveBeenCalledWith('0x1000', 200, -100);
    });
  });

  // ── fetchMore ────────────────────────────────────────────────────────────

  describe('fetchMore', () => {
    it('should append instructions forward and update the stream', async () => {
      const initial = [{ address: '0x1000', instruction: 'nop' }];
      (service as any).instructionsSubject.next(initial);

      const newInsts = [{ address: '0x1004', instruction: 'ret' }];
      mockCacheService.fetchInstructions.mockResolvedValue(newInsts);

      await service.fetchMore('forward');

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[1].address).toBe('0x1004');
    });

    it('should prepend instructions backward and update the stream', async () => {
      const initial = [{ address: '0x1000', instruction: 'nop' }];
      (service as any).instructionsSubject.next(initial);

      const newInsts = [{ address: '0x09F0', instruction: 'prev' }];
      mockCacheService.fetchInstructions.mockResolvedValue(newInsts);

      await service.fetchMore('backward');

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[0].address).toBe('0x09F0');
    });

    it('should use last address + offset=1 for forward fetch', async () => {
      (service as any).instructionsSubject.next([
        { address: '0x1000', instruction: 'nop' },
        { address: '0x1008', instruction: 'ret' },
      ]);
      mockCacheService.fetchInstructions.mockResolvedValue([]);

      await service.fetchMore('forward');

      expect(mockCacheService.fetchInstructions).toHaveBeenCalledWith('0x1008', 100, 1);
    });

    it('should use first address + offset=-100 for backward fetch', async () => {
      (service as any).instructionsSubject.next([
        { address: '0x1000', instruction: 'nop' },
      ]);
      mockCacheService.fetchInstructions.mockResolvedValue([]);

      await service.fetchMore('backward');

      expect(mockCacheService.fetchInstructions).toHaveBeenCalledWith('0x1000', 100, -100);
    });

    it('should not fetch when stream is empty', async () => {
      await service.fetchMore('forward');
      expect(mockCacheService.fetchInstructions).not.toHaveBeenCalled();
    });
  });

  // ── clear ────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('should clear instructions$, reset loading$, and delegate to the cache service', async () => {
      (service as any).instructionsSubject.next([{ address: '0x1000', instruction: 'nop' }]);

      service.clear();

      expect(mockCacheService.clear).toHaveBeenCalled();
      expect(await firstValueFrom(service.instructions$)).toEqual([]);
      expect(await firstValueFrom(service.isLoading$)).toBe(false);
    });
  });
});
