import { Injectable, inject, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, Subscription, firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
import { DapTransportService } from '../transport/dap-transport.service';
import { TransportFactoryService } from '../transport/transport-factory.service';
import { DapConfigService } from './dap-config.service';
import { DapRequest, DapResponse, DapEvent, DisassembleArguments, StepArguments, DapDisassemblyResponse, ReadMemoryArguments, ReadMemoryResponse, WriteMemoryArguments, WriteMemoryResponse } from '../dap.types';
import { DapThreadSession } from './dap-thread';

/** Error thrown when an evaluate request is cancelled or times out */
export class EvaluateCancelledError extends Error {
  constructor(public source: 'user' | 'timeout' = 'user') {
    super(source === 'timeout' ? 'Evaluate timed out' : 'Evaluate cancelled by user');
    this.name = 'EvaluateCancelledError';
  }
}

/** 
 * Exception thrown when the DAP session or transport encounters an 
 * unrecoverable protocol-level failure.
 */
export class DapFatalException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DapFatalException';
  }
}

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

/** Execution State */
export type ExecutionState = 'disconnected' | 'idle' | 'starting' | 'running' | 'stopped' | 'error';

/** Internal state for tracking per-file setBreakpoints serialization */
type BreakpointFileState = { inFlight: boolean; pending: number[] | undefined };

@Injectable()
export class DapSessionService implements OnDestroy {
  private readonly configService = inject(DapConfigService);

  private readonly transportFactory = inject(TransportFactoryService);
  private seq = 1;
  private readonly pendingRequests = new Map<number, { resolve: (response: DapResponse) => void; reject: (error: any) => void; silentError?: boolean }>();
  private messageSubscription?: Subscription;
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

  private readonly threadsSubject = new BehaviorSubject<DapThreadSession[]>([]);
  public readonly threads$ = this.threadsSubject.asObservable();

  private readonly threadObjects = new Map<number, DapThreadSession>();
  private threadEventsBuffer: any[] = [];
  private threadEventTimeout: any = null;
  private threadsQueryInFlight: Promise<void> | null = null;

  private readonly activeThreadSubject = new BehaviorSubject<DapThreadSession | null>(null);
  public readonly activeThread$ = this.activeThreadSubject.asObservable();

  private readonly processInfoSubject = new BehaviorSubject<{ name: string; systemProcessId?: number } | null>(null);
  public readonly processInfo$ = this.processInfoSubject.asObservable();

  public capabilities: any = {};
  private stateTransitionTimer?: any;
  private readonly STATE_TRANSITION_TIMEOUT_MS = 5000;
  private transport: DapTransportService;
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private transportStatusSubscription?: Subscription;

  /** Session-level event Subject, emitted after internal processing */
  private readonly eventSubject = new Subject<DapEvent>();

  /**
   * Diagnostic traffic Subject — emits every outgoing Request and incoming
   * message (Response/Event) as raw payloads. Separate from eventSubject to
   * avoid polluting the business event pipeline with high-frequency telemetry.
   * (See architecture.md §4.6)
   */
  private readonly trafficSubject = new Subject<any>();

  /** Opt-in diagnostic stream for raw DAP protocol traffic. */
  public readonly onTraffic$: Observable<any> = this.trafficSubject.asObservable();

  /** Current debug execution state */
  private executionStateSubject = new BehaviorSubject<ExecutionState>('disconnected');

  /** Emits true while any execution-control command is in-flight */
  private commandInFlightSubject = new BehaviorSubject<boolean>(false);

  public readonly commandInFlight$ = this.commandInFlightSubject.asObservable();

  public get executionState$(): Observable<ExecutionState> {
    return this.executionStateSubject.asObservable();
  }

  public get threadsList(): DapThreadSession[] {
    return this.threadsSubject.value;
  }

  public get executionState(): ExecutionState {
    return this.executionStateSubject.value;
  }

  public constructor() {
    const config = this.configService.getConfig();
    this.transport = this.transportFactory.createTransport(config.transportType);

    // Bridge transport connection status to the Session level
    this.transportStatusSubscription = this.transport.connectionStatus$.subscribe(
      status => this.connectionStatusSubject.next(status)
    );
  }

  public ngOnDestroy(): void {
    this.closeTransport();
    this.transportStatusSubscription?.unsubscribe();
  }

  private closeTransport(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = undefined;
    }
    this.transport.disconnect();
    this.connectionStatusSubject.next(false);
  }


  /**
   * Get connection status Observable (false until transport is established)
   */
  public get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  /**
   * Starts a complete DAP Session.
   * 
   * Follows the standard DAP message flow:
   * 1. Establish underlying Transport connection
   * 2. Send initialize request
   * 3. Wait for initialized event (configurationDone is handled internally)
   * 4. Send launch/attach request (response returns after configurationDone)
   */
  public async startSession(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    if (config.transportType === 'websocket' && !config.serverAddress) {
      throw new Error('Server address is empty');
    }

    if (!this.connectionStatusSubject.value) {
      try {
        // Wait for the connection to be established (timeout 3000ms)
        await firstValueFrom(this.transport.connect(config.serverAddress).pipe(timeout(3000)));
      } catch (e: any) {
        if (e.name === 'TimeoutError') {
          throw new Error(`Connection to ${config.serverAddress} timed out`);
        }
        throw new Error(`${config.transportType} connection failed`);
      }

      if (this.messageSubscription) {
        this.messageSubscription.unsubscribe();
      }

      this.messageSubscription = this.transport.onMessage().subscribe({
        next: (msg) => this.handleIncomingMessage(msg),
        error: (err) => this.handleIncomingTransportError(err),
        complete: () => this.handleIncomingTransportComplete()
      });
    }

    this.executionStateSubject.next('starting');

    // ── Setup Handshake Phase ───────────────────────────────────────────────
    // Per WI-136 spec: the client MUST send a setup channel command and await
    // session-ready before issuing any standard DAP messages.
    const setupResultPromise = firstValueFrom(
      this.eventSubject.pipe(
        filter((e: any) =>
          e.channel === 'setup' &&
          (e.event === 'session-ready' || e.event === 'session-failed')
        ),
        timeout(10000)
      )
    );

    // Send setup handshake command dynamically based on configured setupMode
    if (config.setupMode === 'new') {
      this.transport.sendRequest({
        channel: 'setup',
        command: 'new-session',
        arguments: {
          sessionPath: config.sessionPath,
          config: {
            program: config.executablePath,
            args: config.programArgs ? config.programArgs.split(' ').filter(a => a.length > 0) : [],
            cwd: config.sourcePath || undefined
          }
        }
      } as any);
    } else {
      this.transport.sendRequest({
        channel: 'setup',
        command: 'open-session',
        arguments: {
          sessionPath: config.sessionPath || '.tarodb'
        }
      } as any);
    }

    let setupResult: any;
    try {
      setupResult = await setupResultPromise;
    } catch (e: any) {
      this.closeTransport();
      this.executionStateSubject.next('disconnected');
      if (e.name === 'TimeoutError') {
        throw new Error('Session setup handshake timed out');
      }
      throw e;
    }

    if (setupResult.event === 'session-failed') {
      const reason = setupResult.body?.error || 'Unknown session setup failure';
      this.closeTransport();
      this.executionStateSubject.next('disconnected');
      throw new Error(`Session setup failed: ${reason}`);
    }

    // session-ready: merge returned configuration into DapConfigService so that
    // the frontend UI reflects what the backend actually loaded from config.json.
    if (setupResult.body?.config?.configuration) {
      const backendConfig = setupResult.body.config.configuration;
      const currentConfig = this.configService.getConfig();
      this.configService.setConfig({
        ...currentConfig,
        executablePath: backendConfig.program || currentConfig.executablePath,
        sourcePath: backendConfig.cwd || currentConfig.sourcePath,
        programArgs: Array.isArray(backendConfig.args)
          ? backendConfig.args.join(' ')
          : currentConfig.programArgs
      });
    }

    // ── Standard DAP Initialization Phase ──────────────────────────────────

    const initializedPromise = firstValueFrom(
      this.eventSubject.pipe(filter(e => e.event === 'initialized'))
    );

    // Step 1: Send initialize request
    const initResponse = await this.sendRequest('initialize', {
      clientID: 'taro-debugger-frontend',
      clientName: 'Taro Debugger',
      adapterID: 'gdb',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: true,
      supportsRunInTerminalRequest: false,
      supportsMemoryReferences: true
    });
    this.capabilities = initResponse.body || {};

    if (!this.capabilities.supportsTerminateRequest) {
      throw new DapFatalException('Debug adapter does not support terminate request');
    }

    // Step 2: Send launch/attach request (fire-and-forget, don't wait for response yet)
    // According to DAP spec, launch/attach response returns after configurationDone
    const launchPromise = this.launchOrAttach();

    // Step 3: Wait for initialized event
    await initializedPromise;

    // Step 4: Send all stored breakpoints before configurationDone (DAP spec § Configuration)
    await this.resyncAllBreakpointsInternal();

    // Step 5: Handle stop-on-entry via function breakpoints if requested
    if (config.stopOnEntry) {
      await this.setFunctionBreakpoints([{ name: 'main' }], true);
    }

    // Step 6: Send configurationDone
    await this.sendRequest('configurationDone');

    // Step 7: Wait for launch/attach response (the Server will reply at this point)
    const launchResponse = await launchPromise;
    this.executionStateSubject.next('running');
    void this.fetchThreads();

    return launchResponse;
  }

  /**
   * Decides whether to call launch or attach based on configuration (internal use)
   */
  private async launchOrAttach(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    const command = config.launchMode;

    const argsArray = config.programArgs ? config.programArgs.split(' ').filter(a => a.length > 0) : [];

    const args = {
      program: config.executablePath,
      cwd: config.sourcePath || undefined,
      args: argsArray
    };

    return this.sendRequest(command, args);
  }

  /**
   * Disconnect the session calmly.
   * @param options.terminateDebuggee - Whether the debuggee should be terminated (default: true)
   * @param options.restart - Whether this disconnect is part of a restart flow (default: false)
   */
  private async disconnect(options: { terminateDebuggee?: boolean } = {}): Promise<void> {
    const state = this.executionStateSubject.value;
    if (state === 'disconnected' || state === 'error') {
      return;
    }
    else if (state !== 'idle') {
      throw new DapFatalException(`Cannot disconnect from state '${state}'`);
    }

    this.executionStateSubject.next('disconnected');
    this.reset();
    try {
      if (this.transport) {
        // Send disconnect request to DAP Server (with 2s timeout)
        await this.sendRequest('disconnect', {
          terminateDebuggee: options.terminateDebuggee ?? true
        }, 2000);
      }
    } catch (e) {
      console.warn('Failed to send disconnect request cleanly', e);
    }
  }

  /**
   * Reset session completely to idle, without sending a DAP request.
   * Clears resources directly (e.g., used to return from error to idle safely).
   */
  private reset(): void {
    for (const [seq, handler] of this.pendingRequests.entries()) {
      handler.reject(new Error('Session reset'));
      this.pendingRequests.delete(seq);
    }

    this.commandInFlightSubject.next(false);
    this.clearSessionData();
  }

  /**
   * Public API for stopping the debug session.
   *
   * Mandatorily sends a 'terminate' request to the debug adapter.
   */
  public async stop(): Promise<void> {
    const state = this.executionStateSubject.value;
    switch (state) {
      case 'error':
      case 'idle':
      case 'disconnected':
        return;
      case 'starting':
      case 'running':
      case 'stopped': {
        const terminatedPromise = firstValueFrom(
          this.eventSubject.pipe(
            filter(e => e.event === 'terminated'),
            timeout(2000)
          )
        ).catch(() => { });

        await this.sendRequest('terminate');
        await terminatedPromise;
        break;
      }
    }
  }

  /**
   * Public API for restarting the debug session.
   *
   * Hierarchical strategy (R-CS5):
   * 1. If the adapter supports 'restart', send 'restart' request.
   * 2. Otherwise, perform a "Soft Restart": disconnect followed by startSession.
   */
  public async restart(): Promise<void> {
    const state = this.executionStateSubject.value;
    if (state === 'starting' || state === 'idle') {
      return;
    }

    // Soft Restart Fallback
    if (state === 'running' || state === 'stopped') {
      // Session is active: cleanly terminate the debuggee, then reconnect.
      await this.stop();
    }
    // For terminated/idle: disconnect() would be a no-op, so go straight to startSession.
    await this.startSession();
  }

  /**
   * Continue execution
   */
  public async continue(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'continue', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard('continue');
    try {
      const threadId = this.activeThreadSubject.value?.id || 1;
      const response = await this.sendRequest('continue', { threadId });
      if (response.success) {
        // DAP Spec: If allThreadsContinued is missing, assume true.
        this.handleResumptionState(response.body?.allThreadsContinued ?? true, threadId);
      } else {
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  /**
   * Step Over (Next)
   */
  public async next(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'next', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard('next');
    try {
      const threadId = this.activeThreadSubject.value?.id || 1;
      const response = await this.sendRequest('next', { threadId });
      if (response.success) {
        this.handleResumptionState(false, threadId);
      } else {
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  /**
   * Step Into
   */
  public async stepIn(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'stepIn', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard('stepIn');
    try {
      const threadId = this.activeThreadSubject.value?.id || 1;
      const response = await this.sendRequest('stepIn', { threadId });
      if (response.success) {
        this.handleResumptionState(false, threadId);
      } else {
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  /**
   * Step Out
   */
  public async stepOut(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'stepOut', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard('stepOut');
    try {
      const threadId = this.activeThreadSubject.value?.id || 1;
      const response = await this.sendRequest('stepOut', { threadId });
      if (response.success) {
        this.handleResumptionState(false, threadId);
      } else {
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  /**
   * Step Over at Instruction Level (Nexti)
   */
  public async nextInstruction(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'next', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard('nextInstruction');
    try {
      const threadId = this.activeThreadSubject.value?.id || 1;
      const args: StepArguments = { threadId, granularity: 'instruction' };
      const response = await this.sendRequest('next', args);
      if (response.success) {
        this.handleResumptionState(false, threadId);
      } else {
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  /**
   * Step Into at Instruction Level (Stepi)
   */
  public async stepInInstruction(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'stepIn', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard('stepInInstruction');
    try {
      const threadId = this.activeThreadSubject.value?.id || 1;
      const args: StepArguments = { threadId, granularity: 'instruction' };
      const response = await this.sendRequest('stepIn', args);
      if (response.success) {
        this.handleResumptionState(false, threadId);
      } else {
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      throw e;
    }
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
      const response = await this.sendRequest('setBreakpoints', {
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
    const response = await this.sendRequest('setFunctionBreakpoints', {
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
  private async resyncAllBreakpointsInternal(): Promise<void> {
    if (this.breakpointsMap.size === 0) return;

    const syncPromises = Array.from(this.breakpointsMap.entries()).map(([path, bps]) => {
      const lines = bps.map(b => b.line);
      return this.setBreakpoints(path, lines);
    });

    await Promise.allSettled(syncPromises);
  }

  /**
   * Pause execution
   */
  public async pause(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'pause', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    try {
      const threadId = this.activeThreadSubject.value?.id || 1;
      const response = await this.sendRequest('pause', { threadId });
      if (!response.success) {
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  /**
   * Fetch threads and update the subjects. Called internally on 'stopped'.
   */
  public async fetchThreads(): Promise<void> {
    if (this.threadsQueryInFlight) {
      return this.threadsQueryInFlight;
    }

    this.threadsQueryInFlight = (async () => {
      try {
        const response = await this.sendRequest('threads');
        if (response.success && response.body?.threads) {
          const mapped = response.body.threads.map((t: any) => this.getOrCreateThreadObject(t));
          this.threadsSubject.next(mapped);
          const currentActive = this.activeThreadSubject.value;
          const threadsList = response.body.threads;
          if (threadsList.length > 0 && (currentActive === null || !threadsList.some((t: any) => t.id === currentActive.id))) {
            this.activeThreadSubject.next(mapped[0]);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch threads', err);
        this.threadsSubject.next([]);
      } finally {
        this.threadsQueryInFlight = null;
      }
    })();

    return this.threadsQueryInFlight;
  }

  /**
   * Returns or creates the rich ThreadObject for the raw thread payload.
   */
  private getOrCreateThreadObject(thread: import('../dap.types').DapThread): DapThreadSession {
    let obj = this.threadObjects.get(thread.id);
    if (!obj) {
      obj = new DapThreadSession(this, thread);
      this.threadObjects.set(thread.id, obj);
    }
    return obj;
  }

  /**
   * Clears the execution-scoped stackTrace cache for all registered ThreadObjects.
   */
  public clearAllThreadCaches(): void {
    this.threadObjects.forEach((thread) => thread.clearCache());
  }

  /**
   * Set the current active thread and trigger a stackTrace refresh
   */
  public setCurrentThread(thread: DapThreadSession): void {
    if (this.activeThreadSubject.value?.id === thread.id) {
      return;
    }
    this.activeThreadSubject.next(thread);
    // Emitting a synthetic stopped event to trigger debugger.component.ts to reload the call stack
    this.eventSubject.next({
      seq: 0,
      type: 'event',
      event: 'stopped',
      body: { threadId: thread.id }
    });
  }


  /**
   * Get scopes for a specific stack frame
   * @param frameId Stack frame ID
   */
  public async scopes(frameId: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('scopes', { frameId });
  }

  /**
   * Get variables for a specific scope
   * @param variablesReference Variables Reference (from scopes response)
   */
  public async variables(variablesReference: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('variables', { variablesReference });
  }

  /**
   * Disassemble instructions starting from a memory reference.
   * @param args Strongly-typed disassemble arguments
   * @param silentError When true, suppresses the `_dapError` UI event on failure.
   *                    Use this when the caller handles the error itself (e.g. cache service).
   */
  public async disassemble(args: DisassembleArguments, silentError = false): Promise<DapDisassemblyResponse> {
    this.ensureStopped();
    const response = await this.sendRequest('disassemble', args, 500000, silentError);

    // Translation layer to ensure addresses are correctly cast to BigInt
    if (response.body?.instructions) {
      response.body.instructions = response.body.instructions.map((inst: any) => {
        if (inst.address === undefined || inst.instructionBytes === undefined) {
          throw new Error('Invalid disassembly response: missing attributes');
        }
        let byteLength = 1;
        if (inst.instructionBytes) {
          byteLength = Math.max(1, Math.floor(inst.instructionBytes.replace(/\s+/g, '').length / 2));
        }
        return {
          ...inst,
          address: BigInt(inst.address),
          instructionByteLength: byteLength
        };
      });
    }

    return response as DapDisassemblyResponse;
  }

  /**
   * Reads memory from the debuggee.
   * @param args readMemory arguments
   */
  public async readMemory(args: ReadMemoryArguments): Promise<ReadMemoryResponse> {
    this.ensureStopped();
    const response = await this.sendRequest('readMemory', args);
    return response as ReadMemoryResponse;
  }

  /**
   * Writes memory to the debuggee.
   * @param args writeMemory arguments
   */
  public async writeMemory(args: WriteMemoryArguments): Promise<WriteMemoryResponse> {
    this.ensureStopped();
    const response = await this.sendRequest('writeMemory', args);
    return response as WriteMemoryResponse;
  }

  /**
   * Sends a DAP `cancel` request for the given in-flight request.
   * No-op if called after session disconnect.
   * Pre-condition: capabilities.supportsCancelRequest must be true.
   * @param requestId - The `seq` of the request to cancel.
   */
  public async cancelRequest(requestId: number): Promise<void> {
    if (!this.capabilities?.supportsCancelRequest) {
      return;
    }
    if (this.transport && this.executionStateSubject.value !== 'idle' &&
      this.executionStateSubject.value !== 'disconnected' &&
      this.executionStateSubject.value !== 'error') {
      try {
        await this.sendRequest('cancel', { requestId });
      } catch (e) {
        // Ignored; typically means adapter rejected the cancel or already completed
      }
    }
  }

  /**
   * Sends a DAP `evaluate` request with a built-in 30 s cancel timeout.
   * Rejects with EvaluateCancelledError on user cancel or timeout.
   * Returns the full DAP response on success.
   */
  public evaluate(expression: string, frameId?: number): Promise<DapResponse> {
    const TIMEOUT_MS = 30_000;

    // sendRequest generates the next seq internally right away, but to capture it,
    // we use the current seq value. Keep in mind seq is incremented synchronously.
    const expectedSeq = this.seq;
    // We provide 35000 here so the internal DAP timeout doesn't fire before our 30000 timer.
    const evaluatePromise = this.sendRequest('evaluate', { expression, frameId, context: 'repl' }, 35000, true);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cancelRequest(expectedSeq);
        reject(new EvaluateCancelledError('timeout'));
      }, TIMEOUT_MS);

      evaluatePromise.then((res) => {
        clearTimeout(timer);
        resolve(res);
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Get all sources currently loaded by the debug adapter.
   */
  public async loadedSources(): Promise<DapResponse> {
    return this.sendRequest('loadedSources', {});
  }

  /**
   * Get the content of a specific source file.
   */
  public async source(args: { sourceReference: number; source?: { path: string } }): Promise<DapResponse> {
    return this.sendRequest('source', args);
  }

  /**
   * Wrapper for sending a request and waiting for its response.
   * @param command DAP command name
   * @param args DAP command arguments (optional)
   * @param timeoutMs Timeout in milliseconds (default 5000ms)
   */
  public sendRequest(command: string, args?: any, timeoutMs: number = 500000, silentError: boolean = false): Promise<DapResponse> {
    const transport = this.transport;
    if (!transport) {
      return Promise.reject(new Error('Transport not initialized. Call startSession() first.'));
    }

    return new Promise((resolve, reject) => {
      const currentSeq = this.seq++;

      const request: DapRequest = {
        seq: currentSeq,
        type: 'request',
        command: command,
        arguments: args
      };

      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(currentSeq)) {
          this.pendingRequests.delete(currentSeq);
          const msg = `DAP request '${command}' timed out after ${timeoutMs}ms`;
          this.eventSubject.next({
            seq: 0,
            type: 'event',
            event: '_sessionWarning',
            body: { message: msg }
          });
          reject(new Error(msg));
        }
      }, timeoutMs);

      const resolveWrapper = (response: DapResponse) => {
        clearTimeout(timeoutId);
        resolve(response);
      };

      const rejectWrapper = (error: any) => {
        clearTimeout(timeoutId);
        reject(error);
      };

      this.pendingRequests.set(currentSeq, { resolve: resolveWrapper, reject: rejectWrapper, silentError });
      transport.sendRequest(request);
      // Emit outgoing request to diagnostic traffic stream (§4.6)
      this.trafficSubject.next(request);
    });
  }

  /**
   * Provides the session-level event stream (pre-processed by the Session)
   */
  public onEvent(): Observable<DapEvent> {
    return this.eventSubject.asObservable();
  }

  // ── Session Event Handling ─────────────────────────────────────────

  /**
   * Check if current state is 'stopped', otherwise throw error (per R6 spec)
   */
  private ensureStopped(): void {
    if (this.executionStateSubject.value !== 'stopped') {
      throw new Error(`Invalid state: operation requires the execution to be 'stopped', but current state is '${this.executionStateSubject.value}'`);
    }
  }

  // ── Message & Transport Handling ───────────────────────────────────

  private handleIncomingMessage(msg: any): void {
    // Emit all incoming messages to the diagnostic traffic stream before processing (§4.6)
    this.trafficSubject.next(msg);

    // ── Setup Channel Intercept ──────────────────────────────────────────────
    // Messages from the taro-session setup channel (session-ready / session-failed)
    // are not standard DAP messages; route them directly to the event subject.
    if (msg.channel === 'setup') {
      this.eventSubject.next(msg as any);
      return;
    }

    if (msg.type === 'response') {
      const response = msg as DapResponse;
      const handler = this.pendingRequests.get(response.request_seq);
      if (handler) {
        this.pendingRequests.delete(response.request_seq);
        if (response.success) {
          handler.resolve(response);
        } else {
          // Emit DAP error response as a synthetic event for UI-layer notification (R7)
          // Suppressed if silentError is requested (WI-92)
          if (!handler.silentError) {
            this.eventSubject.next({
              seq: 0,
              type: 'event',
              event: '_dapError',
              body: {
                command: response.command,
                message: response.message || `Command '${response.command}' failed`
              }
            });
          }
          handler.reject(new Error(response.message || `Command ${response.command} failed`));
        }
      } else {
        // Invalid response: no matching pending request — emit as _sessionWarning (§7.2)
        this.eventSubject.next({
          seq: 0,
          type: 'event',
          event: '_sessionWarning',
          body: {
            message: `Received DAP response for unknown request_seq=${response.request_seq}, command='${response.command}'. Ignoring.`
          }
        });
      }
    } else if (msg.type === 'event') {
      this.handleTransportEvent(msg as DapEvent);
    }
  }

  private handleIncomingTransportError(err: any): void {
    const errMsg = err?.message || 'Unknown transport error';
    // Emit synthetic event for UI-layer notification before transitioning state
    this.eventSubject.next({
      seq: 0,
      type: 'event',
      event: '_transportError',
      body: { reason: 'error', message: errMsg }
    });
    // Mandatory: close transport before entering error state (R-ERR1)
    this.closeTransport();
    this.executionStateSubject.next('error');
    this.commandInFlightSubject.next(false);
    for (const [seq, handler] of this.pendingRequests.entries()) {
      handler.reject(err);
      this.pendingRequests.delete(seq);
    }
    this.clearSessionData();
  }

  private handleIncomingTransportComplete(): void {
    if (this.executionStateSubject.value !== 'idle' && this.executionStateSubject.value !== 'disconnected') {
      this.handleIncomingTransportError(new Error("Connection to Debug session was unexpectedly closed"));
    }
  }

  private clearSessionData(): void {
    if (this.threadEventTimeout) {
      clearTimeout(this.threadEventTimeout);
      this.threadEventTimeout = null;
    }
    this.threadEventsBuffer = [];
    this.threadObjects.forEach(t => t.setStatus('exited'));
    this.threadObjects.clear();
    this.threadsSubject.next([]);
    this.activeThreadSubject.next(null);
    this.processInfoSubject.next(null);
    this.breakpointsMap.clear();
    this.breakpointsSubject.next(new Map());
    this.clearStateTransitionGuard();
    this.commandInFlightSubject.next(false);
  }

  /**
   * Unified handler for debug resumption state (Continue, Step, etc).
   * Synchronizes execution state, stopped thread tracking, and reason maps.
   */
  private handleResumptionState(allThreads: boolean, threadId?: number): void {
    this.clearAllThreadCaches();
    if (allThreads) {
      this.executionStateSubject.next('running');
      this.threadObjects.forEach(t => t.setStatus('running'));

      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      this.threadsSubject.next([...this.threadsSubject.value]);
      return;
    }

    if (threadId !== undefined) {
      const resT = this.threadObjects.get(threadId);
      if (resT) {
        resT.setStatus('running');
      }

      const hasStopped = Array.from(this.threadObjects.values()).some(t => t.status === 'stopped');
      if (!hasStopped) {
        this.executionStateSubject.next('running');
      }

      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      this.threadsSubject.next([...this.threadsSubject.value]);
    }
  }

  /**
   * Handles raw DAP events from the Transport layer.
   * The Session updates internal state and performs automatic responses,
   * then forwards the event to external subscribers.
   */
  private handleTransportEvent(event: DapEvent): void {
    switch (event.event) {
      case 'initialized':
        // The initialized event processing (launch + configurationDone) is managed by startSession()
        break;

      case 'stopped': {
        this.executionStateSubject.next('stopped');
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
        const stoppedThreadId = event.body?.threadId;
        const allThreadsStopped = event.body?.allThreadsStopped ?? false;

        const hitBps = event.body?.hitBreakpointIds || [];
        const isSystemStop = hitBps.some((id: number) => this.systemBreakpointIds.has(id));
        let stopReason = event.body?.description || event.body?.reason || 'paused';
        if (isSystemStop) {
          stopReason = 'Paused at entry (main)';
        }

        let stoppedThreadObj: DapThreadSession | undefined;
        if (stoppedThreadId !== undefined) {
          stoppedThreadObj = this.getOrCreateThreadObject({ id: stoppedThreadId, name: `Thread ${stoppedThreadId}` });
        }

        if (allThreadsStopped) {
          this.threadObjects.forEach(t => {
            t.setStatus('stopped');
          });
          if (stoppedThreadObj) {
            stoppedThreadObj.setStopReason(stopReason);
          }
        } else if (stoppedThreadObj) {
          stoppedThreadObj.setStatus('stopped');
          stoppedThreadObj.setStopReason(stopReason);
        }

        if (stoppedThreadObj) {
          this.activeThreadSubject.next(stoppedThreadObj);
        } else if (this.activeThreadSubject.value === null) {
          const firstStopped = Array.from(this.threadObjects.values()).find(t => t.status === 'stopped');
          if (firstStopped) {
            this.activeThreadSubject.next(firstStopped);
          }
        }

        this.threadsSubject.next([...this.threadsSubject.value]);
        void this.fetchThreads();
        break;
      }

      case 'continued':
        this.handleResumptionState(
          event.body?.allThreadsContinued ?? true,
          event.body?.threadId
        );
        break;

      case 'thread': {
        this.handleThreadEvent(event.body);
        break;
      }

      case 'exited': {
        const state = this.executionStateSubject.value;
        if (state === 'running' || state === 'stopped') {
          this.executionStateSubject.next('idle');
          this.reset();
        }
        break;
      }

      case 'terminated': {
        this.disconnect();
        break;
      }

      case 'process':
        this.processInfoSubject.next({
          name: event.body?.name,
          systemProcessId: event.body?.systemProcessId
        });
        break;

      case 'breakpoint': {
        const bp = event.body?.breakpoint;
        if (bp && bp.source?.path && bp.line !== undefined) {
          // If this is a system-managed breakpoint (e.g. stop-on-entry), ignore it here
          // to prevent it from appearing in the user's breakpoint list (WI-123).
          if (bp.id !== undefined && this.systemBreakpointIds.has(bp.id)) {
            break;
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
            break;
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
        break;
      }
    }

    // Forward processed event to external subscribers (Components, etc.)
    this.eventSubject.next(event);
  }

  // ── State Transition Guard ───────────────────────────────────────────────
  // Fires if the adapter fails to emit a stopped/continued event after a
  // control command, unlocking the UI and reporting a synthetic session error.

  private startStateTransitionGuard(command: string): void {
    this.clearStateTransitionGuard();
    this.stateTransitionTimer = setTimeout(() => {
      if (this.commandInFlightSubject.value) {
        this.commandInFlightSubject.next(false);
        this.eventSubject.next({
          seq: 0,
          type: 'event',
          event: '_sessionError',
          body: {
            message: `'${command}': adapter did not emit a state transition within ${this.STATE_TRANSITION_TIMEOUT_MS}ms. UI unlocked.`
          }
        });
      }
    }, this.STATE_TRANSITION_TIMEOUT_MS);
  }

  private clearStateTransitionGuard(): void {
    if (this.stateTransitionTimer) {
      clearTimeout(this.stateTransitionTimer);
      this.stateTransitionTimer = undefined;
    }
  }

  /**
   * Handles incoming DAP 'thread' events by buffering them.
   */
  private handleThreadEvent(eventBody: any): void {
    this.threadEventsBuffer.push(eventBody);

    if (!this.threadEventTimeout) {
      this.threadEventTimeout = setTimeout(() => {
        this.flushThreadEventsBuffer();
      }, 50); // 50ms buffering window
    }
  }

  private flushThreadEventsBuffer(): void {
    this.threadEventTimeout = null;
    const events = [...this.threadEventsBuffer];
    this.threadEventsBuffer = [];

    let currentThreads = [...this.threadsSubject.value];

    for (const body of events) {
      const reason = body.reason;
      const threadId = body.threadId;
      if (threadId === undefined) continue;

      if (reason === 'started') {
        if (!currentThreads.some(t => t.id === threadId)) {
          const threadObj = this.getOrCreateThreadObject({ id: threadId, name: `Thread ${threadId}` });
          currentThreads.push(threadObj);
        }
      } else if (reason === 'exited') {
        const exitedThread = this.threadObjects.get(threadId);
        if (exitedThread) {
          exitedThread.setStatus('exited');
        }
        currentThreads = currentThreads.filter(t => t.id !== threadId);
        this.threadObjects.delete(threadId);
      }
    }

    this.threadsSubject.next(currentThreads);
    const hasStopped = currentThreads.some(t => t.status === 'stopped');
    if (!hasStopped && this.executionState === 'stopped') {
      this.executionStateSubject.next('running');
    }
  }
}
