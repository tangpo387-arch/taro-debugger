import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapVariablesService } from './dap-variables.service';
import { DapSessionService } from './dap-session.service';
import type { ExecutionState } from './dap-session.service';

// ── Test Helpers ────────────────────────────────────────────────────────────

/** Builds a minimal mock DAP scopes response. */
function makeScopesResponse(scopes: { name: string; variablesReference: number; expensive: boolean }[]) {
  return { success: true, body: { scopes } };
}

/** Builds a minimal mock DAP variables response. */
function makeVariablesResponse(variables: { name: string; value: string; variablesReference: number }[]) {
  return { success: true, body: { variables } };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('DapVariablesService', () => {
  let service: DapVariablesService;
  let mockDapSession: any;
  let executionState$: BehaviorSubject<ExecutionState>;

  beforeEach(() => {
    executionState$ = new BehaviorSubject<ExecutionState>('stopped');

    mockDapSession = {
      executionState$: executionState$.asObservable(),
      scopes: vi.fn(),
      variables: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DapVariablesService,
        { provide: DapSessionService, useValue: mockDapSession },
      ],
    });

    service = TestBed.inject(DapVariablesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  // ── Creation ──────────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with an empty scopes$ observable', async () => {
    const scopes = await firstValueFrom(service.scopes$);
    expect(scopes).toEqual([]);
  });

  // ── fetchScopes ───────────────────────────────────────────────────────────

  describe('fetchScopes', () => {
    it('should update scopes$ with the response when successful', async () => {
      const fakeScopes = [
        { name: 'Locals', variablesReference: 101, expensive: false },
        { name: 'Globals', variablesReference: 102, expensive: true },
      ];
      mockDapSession.scopes.mockResolvedValue(makeScopesResponse(fakeScopes));

      await service.fetchScopes(1);

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual(fakeScopes);
    });

    it('should call dapSession.scopes() with the provided frameId', async () => {
      mockDapSession.scopes.mockResolvedValue(makeScopesResponse([]));

      await service.fetchScopes(42);

      expect(mockDapSession.scopes).toHaveBeenCalledWith(42);
      expect(mockDapSession.scopes).toHaveBeenCalledTimes(1);
    });

    it('should reset scopes$ to [] when the response contains no scopes body', async () => {
      // First, seed with a non-empty state
      mockDapSession.scopes.mockResolvedValueOnce(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      await service.fetchScopes(1);

      // Then fetch again with an empty response
      mockDapSession.scopes.mockResolvedValueOnce({ success: false, body: null });
      await service.fetchScopes(2);

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
    });

    it('should reset scopes$ to [] and rethrow on DAP error', async () => {
      const error = new Error('DAP scopes failed');
      mockDapSession.scopes.mockRejectedValue(error);

      await expect(service.fetchScopes(1)).rejects.toThrow('DAP scopes failed');

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
    });

    it('should emit [] immediately and warn when called with a negative frameId', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await service.fetchScopes(-1);

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
      expect(mockDapSession.scopes).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('-1'));
      warnSpy.mockRestore();
    });

    it('should clear the variables cache when a new fetchScopes is made', async () => {
      // Prime the cache for ref 101
      mockDapSession.variables.mockResolvedValue(
        makeVariablesResponse([{ name: 'x', value: '1', variablesReference: 0 }])
      );
      await service.getVariables(101);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(1);

      // Trigger fetchScopes — should invalidate the cache
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      await service.fetchScopes(2);

      // Now getVariables(101) must issue a NEW network request
      await service.getVariables(101);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(2);
    });
  });

  // ── getVariables ──────────────────────────────────────────────────────────

  describe('getVariables', () => {
    it('should fetch variables from dapSession on first call', async () => {
      const fakeVars = [{ name: 'count', value: '42', variablesReference: 0 }];
      mockDapSession.variables.mockResolvedValue(makeVariablesResponse(fakeVars));

      const result = await service.getVariables(101);

      expect(result).toEqual(fakeVars);
      expect(mockDapSession.variables).toHaveBeenCalledWith(101);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(1);
    });

    it('should return cached result and NOT issue a second DAP request', async () => {
      const fakeVars = [{ name: 'count', value: '42', variablesReference: 0 }];
      mockDapSession.variables.mockResolvedValue(makeVariablesResponse(fakeVars));

      // First call — hits the network
      await service.getVariables(101);
      // Second call — must use cache
      const result = await service.getVariables(101);

      expect(result).toEqual(fakeVars);
      // Network should still have been called exactly once
      expect(mockDapSession.variables).toHaveBeenCalledTimes(1);
    });

    it('should maintain independent cache entries for different variablesReferences', async () => {
      mockDapSession.variables
        .mockResolvedValueOnce(makeVariablesResponse([{ name: 'a', value: '1', variablesReference: 0 }]))
        .mockResolvedValueOnce(makeVariablesResponse([{ name: 'b', value: '2', variablesReference: 0 }]));

      const result101 = await service.getVariables(101);
      const result202 = await service.getVariables(202);

      // Each reference should have its own entry
      expect(result101[0].name).toBe('a');
      expect(result202[0].name).toBe('b');
      expect(mockDapSession.variables).toHaveBeenCalledTimes(2);

      // On second access, both should be served from cache
      await service.getVariables(101);
      await service.getVariables(202);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(2);
    });

    it('should return [] and warn when called with a negative variablesReference', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.getVariables(-5);

      expect(result).toEqual([]);
      expect(mockDapSession.variables).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('-5'));
      warnSpy.mockRestore();
    });

    it('should return [] when variablesReference is 0 (non-expandable leaf node)', async () => {
      const result = await service.getVariables(0);

      expect(result).toEqual([]);
      expect(mockDapSession.variables).not.toHaveBeenCalled();
    });

    it('should rethrow and warn on DAP variables failure', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = new Error('variables request failed');
      mockDapSession.variables.mockRejectedValue(error);

      await expect(service.getVariables(101)).rejects.toThrow('variables request failed');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should NOT cache the result on DAP variables failure, allowing a retry', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = new Error('variables request failed');
      // First call fails; second call succeeds
      mockDapSession.variables
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(
          makeVariablesResponse([{ name: 'x', value: '1', variablesReference: 0 }])
        );

      await expect(service.getVariables(101)).rejects.toThrow('variables request failed');

      // Retry must reach the network again — the failed request must not have been cached
      const result = await service.getVariables(101);
      expect(result[0].name).toBe('x');
      expect(mockDapSession.variables).toHaveBeenCalledTimes(2);
      warnSpy.mockRestore();
    });
  });

  // ── Auto-clear on State Change (SSOT Memory Safety) ───────────────────────

  describe('Auto-clear on execution state change', () => {
    it('should clear immediately when the service is instantiated with a non-"stopped" executionState$', async () => {
      // Arrange: create a fresh TestBed where the session is already "running"
      // before the service is constructed. The BehaviorSubject flushes its
      // current value synchronously to new subscribers, so the constructor's
      // stateSubscription triggers clear() on the very first emit.
      TestBed.resetTestingModule();
      const runningState$ = new BehaviorSubject<ExecutionState>('running');
      const runningSession = {
        executionState$: runningState$.asObservable(),
        scopes: vi.fn(),
        variables: vi.fn(),
      };
      TestBed.configureTestingModule({
        providers: [
          DapVariablesService,
          { provide: DapSessionService, useValue: runningSession },
        ],
      });
      const runningService = TestBed.inject(DapVariablesService);

      // Assert: scopes$ must be [] even before any fetchScopes() call
      const scopes = await firstValueFrom(runningService.scopes$);
      expect(scopes).toEqual([]);
    });

    it('should clear scopes$ when execution state transitions from "stopped" to "running"', async () => {
      // Seed state
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      await service.fetchScopes(1);
      let scopes = await firstValueFrom(service.scopes$);
      expect(scopes.length).toBe(1);

      // Trigger state change to running
      executionState$.next('running');

      scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
    });

    it('should clear the variables cache when state transitions out of "stopped"', async () => {
      // Prime the cache
      mockDapSession.variables.mockResolvedValue(
        makeVariablesResponse([{ name: 'x', value: '5', variablesReference: 0 }])
      );
      await service.getVariables(101);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(1);

      // Trigger state change — cache should be evicted
      executionState$.next('terminated');

      // After clearing, a new request for the same ref must go back to the network
      mockDapSession.variables.mockResolvedValue(
        makeVariablesResponse([{ name: 'x', value: '5', variablesReference: 0 }])
      );
      await service.getVariables(101);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(2);
    });

    it('should clear state on transition to "terminated"', async () => {
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      await service.fetchScopes(1);

      executionState$.next('terminated');

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
    });

    it('should clear state on transition to "error"', async () => {
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      await service.fetchScopes(1);

      executionState$.next('error');

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
    });

    it('should clear state on transition to "idle"', async () => {
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      await service.fetchScopes(1);

      executionState$.next('idle');

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
    });

    it('should NOT clear state when state is already "stopped" and receives another "stopped"', async () => {
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      await service.fetchScopes(1);

      // Another stopped event (e.g., breakpoint re-hit)
      executionState$.next('stopped');

      // Scopes should remain intact — no unnecessary clear
      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes.length).toBe(1);
    });
  });

  // ── clear() ──────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('should reset scopes$ to [] and evict the variables cache', async () => {
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      mockDapSession.variables.mockResolvedValue(
        makeVariablesResponse([{ name: 'x', value: '1', variablesReference: 0 }])
      );
      await service.fetchScopes(1);
      await service.getVariables(101);

      service.clear();

      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);

      // Cache should have been evicted — one more network call expected
      mockDapSession.variables.mockResolvedValue(
        makeVariablesResponse([{ name: 'x', value: '1', variablesReference: 0 }])
      );
      await service.getVariables(101);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(2);
    });

    it('should be idempotent when called on already-cleared state', async () => {
      // Service starts empty; calling clear() multiple times must not throw
      expect(() => service.clear()).not.toThrow();
      expect(() => service.clear()).not.toThrow();
      // scopes$ must remain [] after redundant clear() calls — documents the semantic contract
      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);
    });
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────

  describe('ngOnDestroy', () => {
    it('should unsubscribe from executionState$ to prevent memory leaks', () => {
      const subscriptionSpy = vi.spyOn(
        (service as any).stateSubscription,
        'unsubscribe'
      );

      service.ngOnDestroy();

      expect(subscriptionSpy).toHaveBeenCalledTimes(1);
    });

    it('should clear scopes and cache on destroy', async () => {
      mockDapSession.scopes.mockResolvedValue(
        makeScopesResponse([{ name: 'Locals', variablesReference: 101, expensive: false }])
      );
      mockDapSession.variables.mockResolvedValue(
        makeVariablesResponse([{ name: 'x', value: '1', variablesReference: 0 }])
      );
      await service.fetchScopes(1);
      await service.getVariables(101); // prime the cache

      service.ngOnDestroy();

      // scopes$ must be cleared
      const scopes = await firstValueFrom(service.scopes$);
      expect(scopes).toEqual([]);

      // variablesCache must also be evicted — a subsequent call must hit the network
      mockDapSession.variables.mockResolvedValue(
        makeVariablesResponse([{ name: 'x', value: '1', variablesReference: 0 }])
      );
      await service.getVariables(101);
      expect(mockDapSession.variables).toHaveBeenCalledTimes(2);
    });
  });
});
