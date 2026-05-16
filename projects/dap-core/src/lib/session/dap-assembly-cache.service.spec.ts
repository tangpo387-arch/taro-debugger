import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapAssemblyCacheService } from './dap-assembly-cache.service';
import { DapSessionService } from './dap-session.service';

function makeDisassembleResponse(instructions: { address: bigint; instruction: string; symbol?: string; instructionBytes?: string }[]) {
  const mapped = instructions.map(inst => {
    let byteLength = 1;
    if (inst.instructionBytes) {
      byteLength = Math.max(1, Math.floor(inst.instructionBytes.replace(/\s+/g, '').length / 2));
    }
    return {
      ...inst,
      instructionBytes: inst.instructionBytes || '',
      instructionByteLength: byteLength
    };
  });
  return { success: true, body: { instructions: mapped } };
}

describe('DapAssemblyCacheService', () => {
  let service: DapAssemblyCacheService;
  let mockDapSession: any;

  beforeEach(() => {
    mockDapSession = {
      disassemble: vi.fn(),
      onEvent: vi.fn().mockReturnValue(new Subject().asObservable()),
      connectionStatus$: new BehaviorSubject<boolean>(true).asObservable(),
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
        { address: BigInt('0x1000'), instruction: 'mov eax, 1' },
        { address: BigInt('0x1004'), instruction: 'add eax, 2' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      // First fetch: should call DAP
      await service.fetchInstructions(BigInt('0x1000'), 2, 0);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);

      // Second fetch for same range: should NOT call DAP
      const result = await service.fetchInstructions(BigInt('0x1000'), 2, 0);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(2);
      expect(result[0].address).toBe(BigInt('0x1000'));
    });

    it('should perform gap filling (partial cache hit)', async () => {
      // 1. Fetch first 2 instructions
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: BigInt('0x1000'), instruction: 'inst 1' },
        { address: BigInt('0x1004'), instruction: 'inst 2' },
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 2, 0);

      // 2. Request 4 instructions starting at 0x1000.
      // It should fetch 2 more starting from the end of the cached block.
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: BigInt('0x1008'), instruction: 'inst 3' },
        { address: BigInt('0x100c'), instruction: 'inst 4' },
      ]));

      const result = await service.fetchInstructions(BigInt('0x1000'), 4, 0);

      // Should have called DAP twice total
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);

      // Second call should have offset: 2, count: 2 (gap-fill)
      expect(mockDapSession.disassemble).toHaveBeenLastCalledWith(expect.objectContaining({
        memoryReference: '0x1000',
        instructionOffset: 2,
        instructionCount: 2
      }), true);

      expect(result.length).toBe(4);
      expect(result[3].address).toBe(BigInt('0x100c'));
    });

    it('should perform spatial pruning when cache exceeds limit', async () => {
      service.setCacheLimits(5, 3);

      // 1. Fetch 5 instructions at 0x1000
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: BigInt('0x1000'), instruction: 'i1' },
        { address: BigInt('0x1004'), instruction: 'i2' },
        { address: BigInt('0x1008'), instruction: 'i3' },
        { address: BigInt('0x100c'), instruction: 'i4' },
        { address: BigInt('0x1010'), instruction: 'i5' },
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 5, 0);

      // 2. Fetch 2 more far away at 0x2000 (triggers pruning of 0x1000 block)
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: BigInt('0x2000'), instruction: 'i6' },
        { address: BigInt('0x2004'), instruction: 'i7' },
      ]));
      await service.fetchInstructions(BigInt('0x2000'), 2, 0);

      // 3. 0x1000 should have been pruned — fetch should call DAP again.
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: BigInt('0x1000'), instruction: 'i1' }
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(3);
    });
  });

  // ── Symbol Enhancement ───────────────────────────────────────────────────

  describe('enhanceInstructions', () => {
    it('should parse symbols and calculate byteOffset and isFunctionStart', async () => {
      const fakeInstructions = [
        { address: BigInt('0x1000'), instruction: 'push rbp', symbol: '<main+0>' },
        { address: BigInt('0x1014'), instruction: 'mov rbp, rsp', symbol: '<foo+4>' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      const result = await service.fetchInstructions(BigInt('0x1000'), 2, 0);

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
        { address: BigInt('0x1000'), instruction: 'nop' }
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);

      // Emit terminated event — should clear the cache.
      eventSubject.next({ event: 'terminated' });

      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
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
        { address: BigInt('0x1000'), instruction: 'nop' }
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 1, 0);

      eventSubject.next({ event: 'module', body: { reason: 'new' } });

      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
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
        { address: BigInt('0x1000'), instruction: 'nop' }
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);

      // 'stopped' should NOT evict the cache.
      eventSubject.next({ event: 'stopped', body: { threadId: 1 } });

      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);
    });
  });

  // ── Instruction Merging & Overlap Handling ───────────────────────────────

  describe('Instruction Merging & Overlap Handling', () => {
    it('should drop misaligned backward overlaps during split fetches to maintain strictly ascending addresses', async () => {
      const startAddr = BigInt('0x1006');
      const offset = -2;
      const count = 4;

      mockDapSession.disassemble.mockImplementation(async (args: any) => {
        if (args.memoryReference === '0xfde') {
          // Negative fetch base
          return makeDisassembleResponse([
            { address: BigInt('0x0ff0'), instruction: 'neg1' }, // Length 15
            { address: BigInt('0x0fff'), instruction: 'neg2' }  // Length 7 (ends at 0x1006)
          ]);
        } else if (args.memoryReference === '0x1006') {
          // Positive fetch
          return makeDisassembleResponse([
            { address: BigInt('0x0ff9'), instruction: 'pos1_overlap' }, // Backward dip! Misaligned 13-byte instruction
            { address: BigInt('0x1006'), instruction: 'pos2' }, // Length 15
            { address: BigInt('0x1015'), instruction: 'pos3' }  // Length 4
          ]);
        }
        return makeDisassembleResponse([]);
      });

      const result = await service.fetchInstructions(startAddr, count, offset);

      // 0x0ff9 should be dropped because it is <= maxAddr (0x0fff) from the negative fetch.
      const addresses = result.map(i => Number(i.address));
      expect(addresses).toEqual([0x0ff0, 0x0fff, 0x1006, 0x1015]);
    });

    it('should drop overlaps when merging cached instructions with newly fetched instructions', async () => {
      // 1. Prime cache with x86-like variable length instructions
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([
        { address: BigInt('0x1000'), instruction: 'i1' }, // Length 10
        { address: BigInt('0x100a'), instruction: 'i2' }, // Length 15
        { address: BigInt('0x1019'), instruction: 'i3' }  // Length 5 (ends at 0x101e)
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 3, 0);

      // 2. Fetch extending past cache
      // actualOffset becomes 1, so it fetches the rest via DAP
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([
        { address: BigInt('0x1015'), instruction: 'new1_overlap' }, // Backward dip relative to cache! (Length 9)
        { address: BigInt('0x101e'), instruction: 'new2' }, // Length 4
        { address: BigInt('0x1022'), instruction: 'new3' }  // Length 15
      ]));

      const result = await service.fetchInstructions(BigInt('0x1019'), 3, 0);

      // The merge filter should drop 0x1015 because 0x1015 <= 0x1019 (from cache).
      const addresses = result.map(i => Number(i.address));
      expect(addresses).toEqual([0x1019, 0x101e, 0x1022]);
    });

    it('should correctly calculate instruction size from continuous hex strings to perfectly merge contiguous cache ranges', async () => {
      // 1. Fetch block 1: A single 4-byte instruction using continuous hex format '4883ec10'
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([
        { address: BigInt('0x1000'), instruction: 'sub $0x10,%rsp', instructionBytes: '4883ec10' }
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 1, 0);

      // The cache range should now be [0x1000, 0x1003].

      // 2. Fetch block 2: starts exactly at 0x1004.
      // Since it's outside the first block, actualOffset will trigger a DAP request.
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([
        { address: BigInt('0x1004'), instruction: 'nop' }
      ]));
      await service.fetchInstructions(BigInt('0x1004'), 1, 0);

      // Since the first instruction is 4 bytes, 0x1004 perfectly touches the end of 0x1003.
      // Therefore, the cache ranges should be merged into a single contiguous range [0x1000, 0x1004].

      // We can verify this by checking if asking for the range [0x1000, 2] returns fully from cache
      // without calling DAP, which means the boundary didn't trigger a gap break.
      mockDapSession.disassemble.mockClear();
      const result = await service.fetchInstructions(BigInt('0x1000'), 2, 0);

      // If the bug existed, '4883ec10' would be parsed as 1 byte, creating a gap between 0x1000 and 0x1004,
      // and getFromCache would prematurely break at the false gap boundary, triggering a DAP call.
      expect(mockDapSession.disassemble).not.toHaveBeenCalled();

      const addresses = result.map(i => Number(i.address));
      expect(addresses).toEqual([0x1000, 0x1004]);
    });
  });

  // ── clear() ──────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('should empty all cache state so next fetch goes to DAP', async () => {
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: BigInt('0x1000'), instruction: 'nop' }
      ]));
      await service.fetchInstructions(BigInt('0x1000'), 1, 0);

      service.clear();

      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);
    });
  });

  // ── Range-Embedded Storage Invariants ────────────────────────────

  describe('CachedRange Structure Invariants', () => {
    it('A1 — should produce exactly one CachedRange on single fetch', async () => {
      const fakeInstructions = [
        { address: BigInt('0x1000'), instruction: 'i1', instructionBytes: '90' },
        { address: BigInt('0x1001'), instruction: 'i2', instructionBytes: '90' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      await service.fetchInstructions(BigInt('0x1000'), 2, 0);

      const ranges = (service as any).cachedRanges;
      expect(ranges.length).toBe(1);
      expect(ranges[0].start).toBe(BigInt('0x1000'));
      expect(ranges[0].end).toBe(BigInt('0x1001'));
      expect(ranges[0].instructions.length).toBe(2);
    });

    it('A2 — should keep instructions strictly ascending and de-duplicated', async () => {
      const negPart = [
        { address: BigInt('0x1000'), instruction: 'neg1', instructionBytes: '90909090', instructionByteLength: 4 },
        { address: BigInt('0x1004'), instruction: 'neg2', instructionBytes: '90909090', instructionByteLength: 4 }
      ] as any;
      const posPart = [
        { address: BigInt('0x1002'), instruction: 'overlap', instructionBytes: '90909090909090909090', instructionByteLength: 10 },
        { address: BigInt('0x1008'), instruction: 'pos1', instructionBytes: '90909090', instructionByteLength: 4 }
      ] as any;

      (service as any).mergeBatchIntoRanges(negPart);
      (service as any).mergeBatchIntoRanges(posPart);

      const ranges = (service as any).cachedRanges;
      expect(ranges.length).toBe(1);
      const insts = ranges[0].instructions;
      for (let i = 0; i < insts.length - 1; i++) {
        expect(insts[i].address).toBeLessThan(insts[i + 1].address);
      }
    });

    it('A3 — should collapse two adjacent fetches into a single CachedRange', async () => {
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([
        { address: BigInt('0x1000'), instruction: 'i1', instructionBytes: '9090' }
      ]));
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([
        { address: BigInt('0x1002'), instruction: 'i2', instructionBytes: '90' }
      ]));

      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
      await service.fetchInstructions(BigInt('0x1002'), 1, 0);

      const ranges = (service as any).cachedRanges;
      expect(ranges.length).toBe(1);
      expect(ranges[0].start).toBe(BigInt('0x1000'));
      expect(ranges[0].end).toBe(BigInt('0x1002'));
    });

    it('A4 — should keep two non-adjacent fetches as separate CachedRange objects', async () => {
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([{ address: BigInt('0x1000'), instruction: 'i1' }]));
      mockDapSession.disassemble.mockResolvedValueOnce(makeDisassembleResponse([{ address: BigInt('0x2000'), instruction: 'i2' }]));

      await service.fetchInstructions(BigInt('0x1000'), 1, 0);
      await service.fetchInstructions(BigInt('0x2000'), 1, 0);

      const ranges = (service as any).cachedRanges;
      expect(ranges.length).toBe(2);
      expect(ranges[0].start).toBe(BigInt('0x1000'));
      expect(ranges[1].start).toBe(BigInt('0x2000'));
    });
  });

  describe('Lookup Correctness', () => {
    it('B1 — should return slice from correct range when two ranges exist', async () => {
      (service as any).mergeBatchIntoRanges([{ address: BigInt('0x1000'), instruction: 'i1', instructionByteLength: 1 }]);
      (service as any).mergeBatchIntoRanges([{ address: BigInt('0x2000'), instruction: 'i2', instructionByteLength: 1 }]);

      const result = await service.fetchInstructions(BigInt('0x2000'), 1, 0);

      expect(result.length).toBe(1);
      expect(result[0].address).toBe(BigInt('0x2000'));
      expect(mockDapSession.disassemble).not.toHaveBeenCalled();
    });

    it('B2 — should apply instructionOffset within range boundary', async () => {
      const batch = [
        { address: BigInt('0x1000'), instruction: 'i0', instructionByteLength: 1 },
        { address: BigInt('0x1001'), instruction: 'i1', instructionByteLength: 1 },
        { address: BigInt('0x1002'), instruction: 'i2', instructionByteLength: 1 },
        { address: BigInt('0x1003'), instruction: 'i3', instructionByteLength: 1 },
        { address: BigInt('0x1004'), instruction: 'i4', instructionByteLength: 1 },
      ];
      (service as any).mergeBatchIntoRanges(batch);

      const result = await service.fetchInstructions(BigInt('0x1001'), 1, 2);

      expect(result.length).toBe(1);
      expect(result[0].address).toBe(BigInt('0x1003'));
      expect(mockDapSession.disassemble).not.toHaveBeenCalled();
    });

    it('B3 — should trigger DAP fetch when instructionOffset reaches beyond range end', async () => {
      const batch = [{ address: BigInt('0x1000'), instruction: 'i0', instructionByteLength: 1 }];
      (service as any).mergeBatchIntoRanges(batch);
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([{ address: BigInt('0x1001'), instruction: 'new' }]));

      await service.fetchInstructions(BigInt('0x1000'), 2, 0);

      expect(mockDapSession.disassemble).toHaveBeenCalled();
    });
  });

  describe('Merge Correctness', () => {
    it('C1 — should de-duplicate overlapping batch during merge', async () => {
      (service as any).mergeBatchIntoRanges([
        { address: BigInt('0x1000'), instruction: 'i0', instructionByteLength: 4 },
        { address: BigInt('0x1004'), instruction: 'i1', instructionByteLength: 4 }
      ]);
      const overlapBatch = [
        { address: BigInt('0x1004'), instruction: 'i1', instructionByteLength: 4 },
        { address: BigInt('0x1008'), instruction: 'i2', instructionByteLength: 4 }
      ];

      (service as any).mergeBatchIntoRanges(overlapBatch);

      const ranges = (service as any).cachedRanges;
      expect(ranges[0].instructions.length).toBe(3);
      expect(ranges[0].instructions.map((i: any) => i.address)).toEqual([BigInt('0x1000'), BigInt('0x1004'), BigInt('0x1008')]);
    });

    it('C3 — should bridge two existing ranges with a mid-batch', async () => {
      (service as any).mergeBatchIntoRanges([{ address: BigInt('0x1000'), instruction: 'i0', instructionByteLength: 1 }]);
      (service as any).mergeBatchIntoRanges([{ address: BigInt('0x1002'), instruction: 'i2', instructionByteLength: 1 }]);
      expect((service as any).cachedRanges.length).toBe(2);

      (service as any).mergeBatchIntoRanges([{ address: BigInt('0x1001'), instruction: 'i1', instructionByteLength: 1 }]);

      expect((service as any).cachedRanges.length).toBe(1);
      expect((service as any).cachedRanges[0].start).toBe(BigInt('0x1000'));
      expect((service as any).cachedRanges[0].end).toBe(BigInt('0x1002'));
    });
  });

  describe('Range-Level Eviction', () => {
    it('D1 — should remove the single furthest range as a unit', async () => {
      service.setCacheLimits(5, 3);
      (service as any).mergeBatchIntoRanges(Array.from({ length: 5 }, (_, i) => ({ address: BigInt(0x1000 + i), instruction: 'nop', instructionByteLength: 1 })));
      (service as any).currentIpRef = BigInt(0x1000);

      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: BigInt('0x9000'), instruction: 'nop', instructionByteLength: 1 } as any,
        { address: BigInt('0x9001'), instruction: 'nop', instructionByteLength: 1 } as any
      ]));
      await service.fetchInstructions(BigInt('0x9000'), 2, 0);

      const ranges = (service as any).cachedRanges;
      expect(ranges.some((r: any) => r.start === BigInt(0x1000))).toBe(false);
      expect(ranges.length).toBe(1);
    });

    it('D2 — should preserve the range containing the current IP', async () => {
      service.setCacheLimits(5, 3);
      // Range 1 at 0x1000 (3 insts)
      (service as any).mergeBatchIntoRanges(Array.from({ length: 3 }, (_, i) => ({ address: BigInt(0x1000 + i), instruction: 'nop', instructionByteLength: 1 })));
      // Range 2 at 0x2000 (3 insts)
      (service as any).mergeBatchIntoRanges(Array.from({ length: 3 }, (_, i) => ({ address: BigInt(0x2000 + i), instruction: 'nop', instructionByteLength: 1 })));

      // Set IP back to 0x1000
      (service as any).currentIpRef = BigInt(0x1000);

      // Act
      (service as any).pruneCache();

      // Assert
      const ranges = (service as any).cachedRanges;
      expect(ranges.some((r: any) => r.start === BigInt(0x1000))).toBe(true);
      expect(ranges.some((r: any) => r.start === BigInt(0x2000))).toBe(false);
    });
  });

});

