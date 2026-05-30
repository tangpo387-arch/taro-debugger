import { Injectable, Injector, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DapResponse, DapEvent } from '../dap.types';
import { DapSessionService } from './dap-session.service';

/** A single verified breakpoint returned by the DAP adapter */
export interface VerifiedBreakpoint {
  /** The verified 1-based line number (may differ from the requested line) */
  line: number;
  /** Whether the adapter confirmed this breakpoint as verified */
  verified: boolean;
  /** Whether the breakpoint is currently enabled in the UI */
  enabled: boolean;
  /** Optional adapter-assigned breakpoint ID */
  id?: number;
  /** Optional message from the adapter (e.g., reason for unverified state) */
  message?: string;
}

/** Internal state for tracking per-file setBreakpoints serialization */
type BreakpointFileState = { inFlight: boolean; pending: number[] | undefined };

@Injectable()
export class DapBreakpointManager {
  private readonly injector = inject(Injector);

  private readonly breakpointFileState = new Map<string, BreakpointFileState>();
  
  /** 
   * Centralized SSOT for verified breakpoints across all files. 
   * Keyed by absolute file path. 
   */
  private readonly breakpointsMap = new Map<string, VerifiedBreakpoint[]>();

  /** 
   * Tracks IDs of system-injected breakpoints (e.g., stop-on-entry) 
   * to distinguish them from user-defined breakpoints during 'stopped' events.
   */
  private readonly systemBreakpointIds = new Set<number>();

  /** Reactive stream of the current breakpoint state. */
  private readonly breakpointsSubject = new BehaviorSubject<Map<string, VerifiedBreakpoint[]>>(new Map(this.breakpointsMap));
  public readonly breakpoints$ = this.breakpointsSubject.asObservable();

  /**
   * Clears all local breakpoint state when session terminates or disconnects.
   */
  public clearAll(): void {
    this.breakpointsMap.clear();
    this.systemBreakpointIds.clear();
    this.breakpointFileState.clear();
    this.breakpointsSubject.next(new Map());
  }

  /**
   * Checks if a breakpoint ID belongs to a system-injected breakpoint.
   */
  public isSystemBreakpoint(id: number): boolean {
    return this.systemBreakpointIds.has(id);
  }

  /**
   * Registers a system breakpoint ID directly.
   */
  public addSystemBreakpointId(id: number): void {
    this.systemBreakpointIds.add(id);
  }

  /**
   * Returns the current breakpoints map snapshot.
   */
  public getBreakpointsMap(): Map<string, VerifiedBreakpoint[]> {
    return new Map(this.breakpointsMap);
  }

  /**
   * Synchronize breakpoints for a single source file with the DAP adapter.
   * Per the DAP spec, this replaces all breakpoints for the given source.
   * Implements R-CS4: Per-file serialization and last-write-wins for pending updates.
   * 
   * @param sourcePath Absolute path to the source file
   * @param lines 1-based line numbers of all desired breakpoints in this file
   * @returns Array of verified breakpoint results from the adapter
   */
  public async setBreakpoints(sourcePath: string, lines: number[]): Promise<VerifiedBreakpoint[]> {
    const state = this.breakpointFileState.get(sourcePath) ?? { inFlight: false, pending: undefined };

    // If a request for this file is already in progress, store the latest lines
    // in the pending slot (last-write-wins) and exit early.
    if (state.inFlight) {
      state.pending = lines;
      this.breakpointFileState.set(sourcePath, state);
      return [];
    }

    state.inFlight = true;
    state.pending = undefined;
    this.breakpointFileState.set(sourcePath, state);

    try {
      // Only send enabled breakpoints to the DAP adapter
      const existingBps = this.breakpointsMap.get(sourcePath) || [];
      const enabledLines = lines.filter(line => {
        const existing = existingBps.find(b => b.line === line);
        return existing ? existing.enabled : true;
      });

      const breakpointArgs = enabledLines.map(line => ({ line }));
      
      const sessionService = this.injector.get(DapSessionService);

      const response = await sessionService.sendRequestInternal('setBreakpoints', {
        source: { path: sourcePath },
        breakpoints: breakpointArgs,
        lines: enabledLines
      });

      const rawBreakpoints: any[] = response.body?.breakpoints || [];
      const verified = rawBreakpoints.map((bp: any, index: number) => {
        const requestedLine = enabledLines[index];
        // If the adapter relocated the breakpoint, we still want to keep the 'enabled' 
        // status from the requested line.
        const existing = existingBps.find(b => b.line === requestedLine);
        return {
          line: bp.line ?? requestedLine,
          verified: bp.verified ?? false,
          enabled: existing ? existing.enabled : true,
          id: bp.id,
          message: bp.message
        };
      });

      // Also include the "disabled" breakpoints that were requested but not sent to DAP
      const disabledLines = lines.filter(line => !enabledLines.includes(line));
      const disabledBps: VerifiedBreakpoint[] = disabledLines.map(line => ({
        line,
        verified: false,
        enabled: false
      }));

      const finalBps = [...verified, ...disabledBps].sort((a, b) => a.line - b.line);

      // Update SSOT
      this.breakpointsMap.set(sourcePath, finalBps);
      this.breakpointsSubject.next(new Map(this.breakpointsMap));

      return finalBps;
    } finally {
      const currentState = this.breakpointFileState.get(sourcePath);
      if (currentState) {
        currentState.inFlight = false;
        const nextLines = currentState.pending;
        currentState.pending = undefined;
        this.breakpointFileState.set(sourcePath, currentState);

        if (nextLines !== undefined) {
          void this.setBreakpoints(sourcePath, nextLines);
        }
      }
    }
  }

  /**
   * Sets function breakpoints (symbolic breakpoints).
   * @param breakpoints Array of function names or objects with name/condition
   * @param isSystem Whether these are system-managed breakpoints (e.g., main entry)
   */
  public async setFunctionBreakpoints(breakpoints: { name: string; condition?: string }[], isSystem = false): Promise<any[]> {
    const sessionService = this.injector.get(DapSessionService);

    const response = await sessionService.sendRequestInternal('setFunctionBreakpoints', {
      breakpoints: breakpoints.map(bp => ({
        name: bp.name,
        condition: bp.condition
      }))
    });

    const results = response.body?.breakpoints || [];

    if (isSystem) {
      results.forEach((bp: any) => {
        if (bp.id !== undefined) {
          this.systemBreakpointIds.add(bp.id);
        }
      });
    }

    return results;
  }

  /**
   * Updates the local breakpoint intent and triggers synchronization with the DAP server.
   * This provides immediate "optimistic" UI updates by showing requested breakpoints 
   * as unverified before the server responds.
   */
  private async updateBreakpointIntent(sourcePath: string, lines: number[]): Promise<void> {
    const existingBps = this.breakpointsMap.get(sourcePath) || [];

    // Create optimistic list: 
    // - Keep existing verified/disabled breakpoints if they are still in the 'lines' list
    // - Add new breakpoints as unverified/enabled
    const intentBps: VerifiedBreakpoint[] = lines.map(line => {
      const existing = existingBps.find(b => b.line === line);
      if (existing) return existing;
      return { line, verified: false, enabled: true };
    });

    // Update local state immediately for optimistic UI
    this.breakpointsMap.set(sourcePath, intentBps);
    this.breakpointsSubject.next(new Map(this.breakpointsMap));

    // Trigger real sync with DAP
    await this.setBreakpoints(sourcePath, lines);
  }

  /**
   * Toggles a breakpoint at a specific line.
   * This is the primary entry point for Editor interactions.
   */
  public async toggleBreakpoint(sourcePath: string, line: number): Promise<void> {
    const bps = this.breakpointsMap.get(sourcePath) || [];
    const exists = bps.some(b => b.line === line);

    let newLines: number[];
    if (exists) {
      newLines = bps.filter(b => b.line !== line).map(b => b.line);
    } else {
      newLines = [...bps.map(b => b.line), line];
    }

    await this.updateBreakpointIntent(sourcePath, newLines);
  }

  /**
   * Toggles the enabled state of a specific breakpoint.
   */
  public async toggleBreakpointEnabled(sourcePath: string, line: number): Promise<void> {
    const bps = this.breakpointsMap.get(sourcePath) || [];
    const index = bps.findIndex(b => b.line === line);
    if (index !== -1) {
      bps[index].enabled = !bps[index].enabled;

      // Update local state immediately for optimistic UI
      this.breakpointsMap.set(sourcePath, [...bps]);
      this.breakpointsSubject.next(new Map(this.breakpointsMap));

      // Re-sync with DAP server (only send enabled ones)
      const allLines = bps.map(b => b.line);
      await this.setBreakpoints(sourcePath, allLines);
    }
  }

  /**
   * Removes a specific breakpoint.
   */
  public async removeBreakpoint(sourcePath: string, line: number): Promise<void> {
    const bps = this.breakpointsMap.get(sourcePath) || [];
    const filtered = bps.filter(b => b.line !== line);
    const allLines = filtered.map(b => b.line);

    await this.updateBreakpointIntent(sourcePath, allLines);
  }

  /**
   * Internal helper to re-push all stored breakpoints to a new adapter session.
   * Called during startSession sequence (DAP Configuration phase).
   */
  public async resyncAllBreakpointsInternal(): Promise<void> {
    if (this.breakpointsMap.size === 0) return;

    const syncPromises = Array.from(this.breakpointsMap.entries()).map(([path, bps]) => {
      const lines = bps.map(b => b.line);
      return this.setBreakpoints(path, lines);
    });

    await Promise.allSettled(syncPromises);
  }

  /**
   * Handles breakpoint events from handleTransportEvent.
   */
  public handleBreakpointEvent(event: DapEvent): void {
    const bp = event.body?.breakpoint;
    if (bp && bp.source?.path && bp.line !== undefined) {
      // If this is a system-managed breakpoint (e.g. stop-on-entry), ignore it here
      // to prevent it from appearing in the user's breakpoint list (WI-123).
      if (bp.id !== undefined && this.systemBreakpointIds.has(bp.id)) {
        return;
      }

      const filePath = bp.source.path;
      const currentBps = this.breakpointsMap.get(filePath) || [];

      // Handle removal reason (DAP spec: 'new', 'changed', 'removed')
      if (event.body?.reason === 'removed') {
        const filtered = currentBps.filter(existingBp => {
          if (bp.id !== undefined && existingBp.id === bp.id) return false;
          if (existingBp.line === bp.line) return false;
          return true;
        });
        this.breakpointsMap.set(filePath, filtered);
        this.breakpointsSubject.next(new Map(this.breakpointsMap));
        return;
      }

      // The DAP 'breakpoint' event is typically used to update a single breakpoint's status.
      // Since we don't have a reliable ID mapping in the frontend yet for all adapters,
      // we look for a breakpoint at the same line or with the same adapter ID.
      let found = false;
      const updatedBps = currentBps.map(existingBp => {
        if ((bp.id !== undefined && existingBp.id === bp.id) || existingBp.line === bp.line) {
          found = true;
          return {
            line: bp.line,
            verified: bp.verified ?? false,
            enabled: existingBp.enabled, // Preserve local enabled state
            id: bp.id,
            message: bp.message
          };
        }
        return existingBp;
      });

      if (!found) {
        updatedBps.push({
          line: bp.line,
          verified: bp.verified ?? false,
          enabled: true, // Default to enabled for new server-initiated breakpoints
          id: bp.id,
          message: bp.message
        });
      }

      this.breakpointsMap.set(filePath, updatedBps);
      this.breakpointsSubject.next(new Map(this.breakpointsMap));
    }
  }
}
