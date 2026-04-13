/**
 * @file service.spec.example.ts
 * @description Angular service unit test template for the taro-debugger project.
 *
 * Usage:
 *   1. Copy this file to src/app/<your-service>.spec.ts
 *   2. Replace all occurrences of `ExampleService` with your service class name.
 *   3. Replace the mock factory contents to match the service's actual dependencies.
 *   4. Map each spec-plan heading to an `it()` block inside the appropriate `describe()`.
 */

import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { EMPTY } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Replace with your actual imports ──────────────────────────────────────────
import { ExampleService } from './example.service';
import { DapSessionService } from './dap-session.service';

// ── Mock Factory ──────────────────────────────────────────────────────────────
// Always use a factory function to guarantee a fresh mock object per test.
// Do NOT declare mocks as shared module-level variables.

function makeMockDapSession(overrides: Partial<DapSessionService> = {}): Partial<DapSessionService> {
  return {
    sendRequest: vi.fn().mockResolvedValue({ success: true, body: {} }),
    onEvent: vi.fn().mockReturnValue(EMPTY),
    executionState$: new BehaviorSubject<string>('idle') as any,
    disconnect: vi.fn(),
    ...overrides,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('ExampleService', () => {
  let service: ExampleService;
  let mockSession: ReturnType<typeof makeMockDapSession>;

  // Rebuild the entire TestBed before each test to prevent state leakage.
  beforeEach(() => {
    mockSession = makeMockDapSession();

    TestBed.configureTestingModule({
      providers: [
        ExampleService,
        // Provide the mock in place of the real DapSessionService.
        { provide: DapSessionService, useValue: mockSession },
      ],
    });

    service = TestBed.inject(ExampleService);
  });

  afterEach(() => {
    // Destroy the testing module to trigger ngOnDestroy on all injected services.
    TestBed.resetTestingModule();
  });

  // ── Group: methodName() ────────────────────────────────────────────────────
  // Map each spec-plan section heading to a nested describe block.

  describe('methodName()', () => {
    it('should perform the expected operation on success', async () => {
      // Arrange
      mockSession.sendRequest = vi.fn().mockResolvedValue({
        success: true,
        body: { result: 'expected-value' },
      });

      // Act
      const result = await service.methodName('argument');

      // Assert
      expect(mockSession.sendRequest).toHaveBeenCalledOnce();
      expect(mockSession.sendRequest).toHaveBeenCalledWith('dap-command', { arg: 'argument' });
      expect(result).toBe('expected-value');
    });

    it('should re-throw on DAP request failure', async () => {
      // Arrange
      mockSession.sendRequest = vi.fn().mockRejectedValue(new Error('DAP error'));

      // Act & Assert
      await expect(service.methodName('argument')).rejects.toThrow('DAP error');
    });
  });

  // ── Group: State-driven cleanup ────────────────────────────────────────────

  describe('executionState$ subscription', () => {
    it('should reset internal state when executionState transitions to "running"', async () => {
      // Arrange — pre-populate internal state via a prior operation
      // (replace with real method that populates state)
      // await service.methodName('arg');

      // Act
      (mockSession.executionState$ as BehaviorSubject<string>).next('running');

      // Assert — verify state was cleared
      // expect(service.someInternalState).toEqual([]);
    });
  });

  // ── Group: ngOnDestroy ─────────────────────────────────────────────────────

  describe('ngOnDestroy()', () => {
    it('should unsubscribe from executionState$ and clear internal state', () => {
      // Arrange — spy on the internal Subject if accessible, or verify side-effects
      const destroySpy = vi.spyOn(service, 'ngOnDestroy');

      // Act
      TestBed.resetTestingModule(); // triggers ngOnDestroy on all injected services

      // Assert
      expect(destroySpy).toHaveBeenCalled();
      // expect(service.someInternalState).toEqual([]);
    });
  });
});
