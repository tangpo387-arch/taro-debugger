import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapAssemblyService } from './dap-assembly.service';
import { DapSessionService } from '@taro/dap-core';

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
      onEvent: vi.fn().mockReturnValue(new Subject().asObservable()),
      activeThreadId$: new BehaviorSubject<number | null>(null).asObservable(),
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
      await service.fetchInstructions('0x1000', 2);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[0].address).toBe('0x1000');
    });

    it('should perform gap filling (partial cache hit)', async () => {
      // 1. Fetch first 2 instructions
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1000', instruction: 'inst 1' },
        { address: '0x1004', instruction: 'inst 2' },
      ]));
      await service.fetchInstructions('0x1000', 2);

      // Clear UI stream to bypass the 'Fast-Path' stepping optimization
      // This simulates jumping back to 0x1000 from a different call stack frame
      (service as any).instructionsSubject.next([]);

      // 2. Request 4 instructions starting at 0x1000. 
      // It should fetch 2 more starting from the end of cached block.
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x1008', instruction: 'inst 3' },
        { address: '0x100c', instruction: 'inst 4' },
      ]));

      await service.fetchInstructions('0x1000', 4);

      // Should have called DAP twice
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);

      // Second call should have offset: 2 and count: 2
      expect(mockDapSession.disassemble).toHaveBeenLastCalledWith(expect.objectContaining({
        memoryReference: '0x1000',
        instructionOffset: 2,
        instructionCount: 2
      }));

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(4);
      expect(instructions[3].address).toBe('0x100c');
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

      // 2. Fetch 2 more instructions far away at 0x2000
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x2000', instruction: 'i6' },
        { address: '0x2004', instruction: 'i7' },
      ]));
      await service.fetchInstructions('0x2000', 2);

      // Pruning should have removed the furthest range [0x1000, 0x1010].
      // Fetch 0x1000 again should trigger DAP.
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([{ address: '0x1000', instruction: 'i1' }]));
      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(3);
    });
  });

  describe('Session Lifecycle', () => {
    it('should NOT clear cache when threadId changes', async () => {
      const threadIdSubject = new BehaviorSubject<number | null>(1);
      mockDapSession.activeThreadId$ = threadIdSubject.asObservable();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DapAssemblyService,
          { provide: DapSessionService, useValue: mockDapSession },
        ],
      });
      service = TestBed.inject(DapAssemblyService);

      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([{ address: '0x1000', instruction: 'nop' }]));
      await service.fetchInstructions('0x1000', 1);

      threadIdSubject.next(2);

      // Should hit cache, no second call to DAP
      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(1);
    });

    it('should clear cache on terminated event', async () => {
      const eventSubject = new Subject<any>();
      mockDapSession.onEvent = vi.fn().mockReturnValue(eventSubject.asObservable());

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DapAssemblyService,
          { provide: DapSessionService, useValue: mockDapSession },
        ],
      });
      service = TestBed.inject(DapAssemblyService);

      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([{ address: '0x1000', instruction: 'nop' }]));
      await service.fetchInstructions('0x1000', 1);

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
          DapAssemblyService,
          { provide: DapSessionService, useValue: mockDapSession },
        ],
      });
      service = TestBed.inject(DapAssemblyService);

      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([{ address: '0x1000', instruction: 'nop' }]));
      await service.fetchInstructions('0x1000', 1);

      eventSubject.next({ event: 'module', body: { reason: 'new' } });

      await service.fetchInstructions('0x1000', 1);
      expect(mockDapSession.disassemble).toHaveBeenCalledTimes(2);
    });
  });

  describe('Standard fetchInstructions behavior', () => {
    it('should update instructions$ with the response when successful', async () => {
      const fakeInstructions = [
        { address: '0x1000', instruction: 'mov eax, 1' },
        { address: '0x1005', instruction: 'add eax, 2' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      await service.fetchInstructions('0x1000', 2);

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions).toEqual([
        expect.objectContaining({ address: '0x1000', instruction: 'mov eax, 1' }),
        expect.objectContaining({ address: '0x1005', instruction: 'add eax, 2' }),
      ]);
    });

    it('should correctly parse symbols and calculate offsets', async () => {
      const fakeInstructions = [
        { address: '0x1000', instruction: 'push rbp', symbol: '<main+0>' },
        { address: '0x1014', instruction: 'mov rbp, rsp', symbol: '<foo+4>' },
      ];
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse(fakeInstructions));

      await service.fetchInstructions('0x1000', 2);
      const instructions = await firstValueFrom(service.instructions$);

      expect(instructions[0]).toMatchObject({ normalizedSymbol: 'main', byteOffset: 0, isFunctionStart: true });
      expect(instructions[1]).toMatchObject({ normalizedSymbol: 'foo', byteOffset: 4, isFunctionStart: true });
    });

    it('should respect explicit context window parameters', async () => {
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([]));
      await service.fetchInstructions('0x1000', 200, -100);

      expect(mockDapSession.disassemble).toHaveBeenCalledWith(expect.objectContaining({
        memoryReference: '0x1000',
        instructionOffset: -100,
        instructionCount: 200
      }));
    });

    it('should handle backward auto-fetch (fetchMore)', async () => {
      // 1. Initial state
      const initialInst = { address: '0x1000', instruction: 'nop' };
      service['instructionsSubject'].next([initialInst]);

      // 2. Trigger fetchMore('backward')
      mockDapSession.disassemble.mockResolvedValue(makeDisassembleResponse([
        { address: '0x09F0', instruction: 'prev' }
      ]));

      await service.fetchMore('backward');

      const instructions = await firstValueFrom(service.instructions$);
      expect(instructions.length).toBe(2);
      expect(instructions[0].address).toBe('0x09F0');
      expect(mockDapSession.disassemble).toHaveBeenCalledWith(expect.objectContaining({
        memoryReference: '0x1000',
        instructionOffset: -100 // AUTO_FETCH_COUNT is 100
      }));
    });
  });
});
