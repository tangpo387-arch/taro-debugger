import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { DapSessionService } from '@taro/dap-core';

/** A single scope in the current stack frame. */
export interface DapScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

/** A single local variable returned by the DAP adapter. */
export interface DapVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

/**
 * Service responsible for managing derived runtime state for the Variable Inspector.
 * Caches `variables` responses by `variablesReference` to prevent redundant DAP requests.
 * 
 * Complies with State Management Rule (R_SM1 / R_SM5).
 */
@Injectable()
export class DapVariablesService implements OnDestroy {
  private readonly dapSession = inject(DapSessionService);

  private readonly scopesSubject = new BehaviorSubject<DapScope[]>([]);
  public readonly scopes$: Observable<DapScope[]> = this.scopesSubject.asObservable();

  private readonly variablesCache = new Map<number, DapVariable[]>();
  private readonly stateSubscription: Subscription;

  constructor() {
    // ── Memory and State Clearing ──────────────────────────────────────────────
    // Auto-clear cache and scopes whenever execution state drops out of "stopped".
    // SSOT rule R_SM5 states cleanup should happen when no longer effectively stopped.
    this.stateSubscription = this.dapSession.executionState$.subscribe(state => {
      if (state !== 'stopped') {
        this.clear();
      }
    });
  }

  private lastRequestedFrameId: number | null = null;

  /**
   * Request scopes for a given stack frame ID from the DAP Server.
   * Implements anti-race guard (WI-42) to ensure stale responses are discarded.
   */
  public async fetchScopes(frameId: number): Promise<void> {
    if (frameId < 0) {
      console.warn(`fetchScopes called with invalid frameId: ${frameId}`);
      this.scopesSubject.next([]);
      return;
    }

    this.lastRequestedFrameId = frameId;
    this.variablesCache.clear();

    try {
      const response = await this.dapSession.scopes(frameId);

      // Anti-race guard: only update if this is still the last requested frame
      if (this.lastRequestedFrameId !== frameId) {
        return;
      }

      if (response.success && response.body?.scopes) {
        this.scopesSubject.next(response.body.scopes);
      } else {
        this.scopesSubject.next([]);
      }
    } catch (e) {
      if (this.lastRequestedFrameId === frameId) {
        this.scopesSubject.next([]);
      }
      throw e;
    }
  }

  /**
   * Request variables given a variablesReference.
   * Caches results so multiple expansions of the same variable block don't trigger requests.
   */
  public async getVariables(variablesReference: number): Promise<DapVariable[]> {
    if (variablesReference < 0) {
      console.warn(`getVariables called with invalid variablesReference: ${variablesReference}`);
      return [];
    }

    if (this.variablesCache.has(variablesReference)) {
      return this.variablesCache.get(variablesReference)!;
    }

    if (variablesReference > 0) {
      try {
        const response = await this.dapSession.variables(variablesReference);
        if (response.success && response.body?.variables) {
          const vars = response.body.variables;
          this.variablesCache.set(variablesReference, vars);
          return vars;
        }
      } catch (e) {
        console.warn(`Failed to fetch variables for ref ${variablesReference}`, e);
        throw e;
      }
    }

    return [];
  }

  /**
   * Clear active variable and scope states.
   */
  public clear(): void {
    if (this.scopesSubject.value.length > 0) {
      this.scopesSubject.next([]);
    }
    this.variablesCache.clear();
  }

  public ngOnDestroy(): void {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
    this.clear();
  }
}
