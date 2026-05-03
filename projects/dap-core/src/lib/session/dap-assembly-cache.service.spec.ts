import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapAssemblyCacheService } from './dap-assembly-cache.service';
import { DapSessionService } from './dap-session.service';

/** Builds a minimal mock DAP disassemble response. */
function makeDisassembleResponse(instructions: { address: string; instruction: string; symbol?: string }[]) {
  return { success: true, body: { instructions } };
}

describe('DapAssemblyCacheService', () => {
  let service: DapAssemblyCacheService;
  let mockDapSession: any;

  beforeEach(() => {
    mockDapSession = {
      disassemble: vi.fn(),
      onEvent: vi.fn().mockReturnValue(new Subject().asObservable()),
    };

    TestBed.configureTestingModule({
      providers: [
        DapAssemblyCacheService,
        { provide: DapSessionService, useValue: mockDapSession },
      ],
    });

    service = TestBed.inject(DapAssemblyCacheService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Caching & Performance ────────────────────────────────────────────────

  describe('Caching & Performance', () => {
    it('should cache instructions and avoid redundant DAP requests', async () => {
      const fakeInstructions = [
        { address: '0x1000', instruction: 'mov eax, 1' },
        { address: '0x1004', instruction: 'add eax, 2' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      // First fetch: should call DAP
      await service.fetchInstructions('0x1000', 2);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);

      // Second fetch for same range: should NOT call DAP
      const result = await service.fetchInstructions('0x1000', 2);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(2);
      expect(result[0].address).toBe('0x1000');
    });

    it('should perform gap filling (partial cache hit)', async () => {
      // 1. Fetch first 2 instructions
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'inst 1' },
        { address: '0x1004', instruction: 'inst 2' },
      ]));
      await service.fetchInstructions('0x1000', 2);

      // 2. Request 4 instructions starting at 0x1000.
      // It should fetch 2 more starting from the end of the cached block.
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1008', instruction: 'inst 3' },
        { address: '0x100c', instruction: 'inst 4' },
      ]));

      const result = await service.fetchInstructions('0x1000', 4);

      // Should have called DAP twice total
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);

      // Second call should have offset: 2, count: 2 (gap-fill)
      expect(mockDapSession.disassemble).toHaveBeenLastCalledWith(expect.objectContaining({
        memoryReference: '0x1000',
        instructionOffset: 2,
        instructionCount: 2
      }));

      expect(result.length).toBe(4);
      expect(result[3].address).toBe('0x100c');
    });

    it('should perform spatial pruning when cache exceeds limit', async () => {
      service.setCacheLimits(5, 3);

      // 1. Fetch 5 instructions at 0x1000
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'i1' },
        { address: '0x1004', instruction: 'i2' },
        { address: '0x1008', instruction: 'i3' },
        { address: '0x100c', instruction: 'i4' },
        { address: '0x1010', instruction: 'i5' },
      ]));
      await service.fetchInstructions('0x1000', 5);

      // 2. Fetch 2 more far away at 0x2000 (triggers pruning of 0x1000 block)
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x2000', instruction: 'i6' },
        { address: '0x2004', instruction: 'i7' },
      ]));
      await service.fetchInstructions('0x2000', 2);

      // 3. 0x1000 should have been pruned — fetch should call DAP again.
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'i1' }
      ]));
      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(3);
    });
  });

  // ── Symbol Enhancement ───────────────────────────────────────────────────

  describe('enhanceInstructions', () => {
    it('should parse symbols and calculate byteOffset and isFunctionStart', async () => {
      const fakeInstructions = [
        { address: '0x1000', instruction: 'push rbp', symbol: '<main+0>' },
        { address: '0x1014', instruction: 'mov rbp, rsp', symbol: '<foo+4>' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      const result = await service.fetchInstructions('0x1000', 2);

      expect(result[0]).toMatchObject({ normalizedSymbol: 'main', byteOffset: 0, isFunctionStart: true });
      expect(result[1]).toMatchObject({ normalizedSymbol: 'foo', byteOffset: 4, isFunctionStart: true });
    });
  });

  // ── Session Lifecycle ────────────────────────────────────────────────────

  describe('Session Lifecycle', () => {
    it('should clear cache on terminated event', async () => {
      const eventSubject = new Subject<any>();
      mockDapSession.onEvent = vi.fn().mockReturnValue(eventSubject.asObservable());

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DapAssemblyCacheService,
          { provide: DapSessionService, useValue: mockDapSession },
        ],
      });
      service = TestBed.inject(DapAssemblyCacheService);

      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'nop' }
      ]));
      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);

      // Emit terminated event — should clear the cache.
      eventSubject.next({ event: 'terminated' });

      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on module event', async () => {
      const eventSubject = new Subject<any>();
      mockDapSession.onEvent = vi.fn().mockReturnValue(eventSubject.asObservable());

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DapAssemblyCacheService,
          { provide: DapSessionService, useValue: mockDapSession },
        ],
      });
      service = TestBed.inject(DapAssemblyCacheService);

      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'nop' }
      ]));
      await service.fetchInstructions('0x1000', 1);

      eventSubject.next({ event: 'module', body: { reason: 'new' } });

      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);
    });

    it('should NOT clear cache on unrelated events (e.g. stopped)', async () => {
      const eventSubject = new Subject<any>();
      mockDapSession.onEvent = vi.fn().mockReturnValue(eventSubject.asObservable());

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DapAssemblyCacheService,
          { provide: DapSessionService, useValue: mockDapSession },
        ],
      });
      service = TestBed.inject(DapAssemblyCacheService);

      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'nop' }
      ]));
      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);

      // 'stopped' should NOT evict the cache.
      eventSubject.next({ event: 'stopped', body: { threadId: 1 } });

      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);
    });
  });

  // ── clear() ──────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('should empty all cache state so next fetch goes to DAP', async () => {
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'nop' }
      ]));
      await service.fetchInstructions('0x1000', 1);

      service.clear();

      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);
    });
  });
});
