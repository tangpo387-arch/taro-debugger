import { Injectable, inject, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, Subscription, firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
import { DapTransportService } from '../transport/dap-transport.service';
import { TransportFactoryService } from '../transport/transport-factory.service';
import { DapConfigService } from './dap-config.service';
import { DapRequest, DapResponse, DapEvent, DisassembleArguments, StepArguments, DapDisassemblyResponse, ReadMemoryArguments, ReadMemoryResponse, WriteMemoryArguments, WriteMemoryResponse, DapCapabilities } from '../dap.types';
import { DapThreadSession } from './dap-thread';
import { DapBreakpointManager, VerifiedBreakpoint } from './dap-breakpoint-manager.service';
import { DapThreadManager } from './dap-thread-manager.service';

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

/** Execution State */
export type ExecutionState = 'disconnected' | 'idle' | 'starting' | 'running' | 'stopped' | 'error';

@Injectable()
export class DapSessionService implements OnDestroy {
  private readonly configService = inject(DapConfigService);
  private readonly transportFactory = inject(TransportFactoryService);
  
  // Sub-managers
  private readonly breakpointManager = inject(DapBreakpointManager);
  private readonly threadManager = inject(DapThreadManager);

  private seq = 1;
  private readonly pendingRequests = new Map<number, { resolve: (response: DapResponse) => void; reject: (error: any) => void; silentError?: boolean }>();
  private messageSubscription?: Subscription;

  /** Reactive stream of the current breakpoint state. */
  public readonly breakpoints$ = this.breakpointManager.breakpoints$;

  /** Reactive stream of all active threads. */
  public readonly threads$ = this.threadManager.threads$;

  /** Reactive stream of the active thread. */
  public readonly activeThread$ = this.threadManager.activeThread$;

  private readonly processInfoSubject = new BehaviorSubject<{ name: string; systemProcessId?: number } | null>(null);
  public readonly processInfo$ = this.processInfoSubject.asObservable();

  public capabilities: DapCapabilities = {};
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
    return this.threadManager.threadsList;
  }

  public get executionState(): ExecutionState {
    return this.executionStateSubject.value;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get systemBreakpointIds() {
    return (this.breakpointManager as any).systemBreakpointIds;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get threadObjects() {
    return (this.threadManager as any).threadObjects;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get breakpointsSubject() {
    return (this.breakpointManager as any).breakpointsSubject;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get breakpointsMap() {
    return (this.breakpointManager as any).breakpointsMap;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get activeThreadSubject() {
    return (this.threadManager as any).activeThreadSubject;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get threadsSubject() {
    return (this.threadManager as any).threadsSubject;
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
   * Establishes the underlying connection to the debug transport (e.g., WebSocket).
   */
  public async connectTransport(): Promise<void> {
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
  }

  /**
   * Sends the 'new-session' command on the setup channel and awaits session-ready.
   */
  public async createNewSession(): Promise<void> {
    const config = this.configService.getConfig();
    const setupResultPromise = firstValueFrom(
      this.eventSubject.pipe(
        filter((e: any) =>
          (e.channel === 'setup' && (e.event === 'session-ready' || e.event === 'session-failed')) ||
          e.event === '_transportError'
        ),
        timeout(10000)
      )
    );

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

    await this.handleSetupHandshakeResult(setupResultPromise);
  }

  /**
   * Sends the 'open-session' command on the setup channel and awaits session-ready.
   */
  public async openExistingSession(): Promise<void> {
    const config = this.configService.getConfig();
    const setupResultPromise = firstValueFrom(
      this.eventSubject.pipe(
        filter((e: any) =>
          (e.channel === 'setup' && (e.event === 'session-ready' || e.event === 'session-failed')) ||
          e.event === '_transportError'
        ),
        timeout(10000)
      )
    );

    this.transport.sendRequest({
      channel: 'setup',
      command: 'open-session',
      arguments: {
        sessionPath: config.sessionPath || '.tarodb'
      }
    } as any);

    await this.handleSetupHandshakeResult(setupResultPromise);
  }

  /**
   * Common result handling helper for the setup channel handshake response.
   */
  private async handleSetupHandshakeResult(setupResultPromise: Promise<any>): Promise<void> {
    let setupResult: any;
    try {
      setupResult = await setupResultPromise;
    } catch (e: any) {
      this.closeTransport();
      this.executionStateSubject.next('error');
      if (e.name === 'TimeoutError') {
        throw new Error('Session setup handshake timed out');
      }
      throw e;
    }

    if (setupResult.event === '_transportError') {
      const reason = setupResult.body?.message || 'Connection to Debug session was unexpectedly closed';
      throw new Error(`Session setup failed: ${reason}`);
    }

    if (setupResult.event === 'session-failed') {
      const reason = setupResult.body?.error || 'Unknown session setup failure';
      // Keeping transport open to allow fast retry on the same socket
      this.executionStateSubject.next('error');
      throw new Error(reason);
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
  }

  /**
   * Performs the DAP session handshake and complete initialization sequence.
   * Assumes the underlying transport is already connected.
   */
  private async initializeSession(): Promise<DapResponse> {
    const config = this.configService.getConfig();

    this.executionStateSubject.next('starting');

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
   * Starts a complete DAP Session.
   */
  public async startSession(): Promise<DapResponse> {
    this.assertState(['disconnected', 'idle', 'error'], 'startSession');
    await this.connectTransport();

    const config = this.configService.getConfig();
    this.executionStateSubject.next('starting');

    // ── Setup Handshake Phase ───────────────────────────────────────────────
    if (config.setupMode === 'new') {
      await this.createNewSession();
    } else {
      await this.openExistingSession();
    }
    return this.initializeSession();
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
   */
  private async disconnect(options: { terminateDebuggee?: boolean } = {}): Promise<void> {
    const state = this.executionStateSubject.value;
    if (state === 'disconnected' || state === 'error') {
      return;
    }
    else if ((state !== 'idle') && (state !== 'stopped')) {
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
   */
  public async stop(): Promise<void> {
    const state = this.executionStateSubject.value;
    switch (state) {
      case 'error':
        this.closeTransport();
        this.executionStateSubject.next('disconnected');
        return;
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
   * Asserts that the session is in one of the allowed execution states.
   */
  private assertState(allowedStates: ExecutionState[], actionName: string): void {
    const currentState = this.executionStateSubject.value;
    if (!allowedStates.includes(currentState)) {
      throw new DapFatalException(
        `Cannot perform '${actionName}' from execution state '${currentState}'. Allowed states: ${allowedStates.join(', ')}`
      );
    }
  }

  /**
   * Public API to start the DAP protocol handshake sequence.
   */
  public async start(): Promise<DapResponse> {
    this.assertState(['disconnected', 'idle', 'error'], 'start');
    return this.initializeSession();
  }

  /**
   * Public API for restarting the debug session.
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
    await this.initializeSession();
  }

  // ── Execution Control Commands ──────────────────────────────────────

  private async executeStepCommand(
    command: string,
    allThreadsContinued: boolean,
    extraArgs?: Partial<StepArguments>,
    allowedStates: ExecutionState[] = ['stopped']
  ): Promise<DapResponse> {
    this.assertState(allowedStates, command);
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command, success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard(command);
    try {
      const threadId = this.threadManager.activeThread?.id || 1;
      const args: StepArguments = { threadId, ...extraArgs };
      const response = await this.sendRequest(command, args);
      if (response.success) {
        this.handleResumptionState(
          command === 'continue' ? (response.body?.allThreadsContinued ?? true) : allThreadsContinued,
          threadId
        );
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

  public async continue(): Promise<DapResponse> {
    return this.executeStepCommand('continue', true);
  }

  public async next(): Promise<DapResponse> {
    return this.executeStepCommand('next', false);
  }

  public async stepIn(): Promise<DapResponse> {
    return this.executeStepCommand('stepIn', false);
  }

  public async stepOut(): Promise<DapResponse> {
    return this.executeStepCommand('stepOut', false);
  }

  public async nextInstruction(): Promise<DapResponse> {
    return this.executeStepCommand('next', false, { granularity: 'instruction' });
  }

  public async stepInInstruction(): Promise<DapResponse> {
    return this.executeStepCommand('stepIn', false, { granularity: 'instruction' });
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
      const threadId = this.threadManager.activeThread?.id || 1;
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

  // ── delegated Manager Methods ──────────────────────────────────────────

  public async setBreakpoints(sourcePath: string, lines: number[]): Promise<VerifiedBreakpoint[]> {
    return this.breakpointManager.setBreakpoints(sourcePath, lines);
  }

  public async setFunctionBreakpoints(breakpoints: { name: string; condition?: string }[], isSystem = false): Promise<any[]> {
    return this.breakpointManager.setFunctionBreakpoints(breakpoints, isSystem);
  }

  public async toggleBreakpoint(sourcePath: string, line: number): Promise<void> {
    return this.breakpointManager.toggleBreakpoint(sourcePath, line);
  }

  public async toggleBreakpointEnabled(sourcePath: string, line: number): Promise<void> {
    return this.breakpointManager.toggleBreakpointEnabled(sourcePath, line);
  }

  public async removeBreakpoint(sourcePath: string, line: number): Promise<void> {
    return this.breakpointManager.removeBreakpoint(sourcePath, line);
  }

  public async resyncAllBreakpointsInternal(): Promise<void> {
    return this.breakpointManager.resyncAllBreakpointsInternal();
  }

  public async fetchThreads(): Promise<void> {
    return this.threadManager.fetchThreads();
  }

  public clearAllThreadCaches(): void {
    this.threadManager.clearAllThreadCaches();
  }

  public setCurrentThread(thread: DapThreadSession): void {
    this.threadManager.setCurrentThread(thread);
  }

  public getOrCreateThreadObject(thread: import('../dap.types').DapThread): DapThreadSession {
    return this.threadManager.getOrCreateThreadObject(thread);
  }

  // ── Session Event Handling ─────────────────────────────────────────

  private ensureStopped(): void {
    if (this.executionStateSubject.value !== 'stopped') {
      throw new Error(`Invalid state: operation requires the execution to be 'stopped', but current state is '${this.executionStateSubject.value}'`);
    }
  }

  public async scopes(frameId: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('scopes', { frameId });
  }

  public async variables(variablesReference: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('variables', { variablesReference });
  }

  public async disassemble(args: DisassembleArguments, silentError = false): Promise<DapDisassemblyResponse> {
    this.ensureStopped();
    const response = await this.sendRequest('disassemble', args, 30000, silentError);

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

  public async readMemory(args: ReadMemoryArguments): Promise<ReadMemoryResponse> {
    this.ensureStopped();
    const response = await this.sendRequest('readMemory', args);
    return response as ReadMemoryResponse;
  }

  public async writeMemory(args: WriteMemoryArguments): Promise<WriteMemoryResponse> {
    this.ensureStopped();
    const response = await this.sendRequest('writeMemory', args);
    return response as WriteMemoryResponse;
  }

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

  public evaluate(expression: string, frameId?: number): Promise<DapResponse> {
    const TIMEOUT_MS = 30_000;
    const expectedSeq = this.seq;
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

  public async loadedSources(): Promise<DapResponse> {
    return this.sendRequest('loadedSources', {});
  }

  public async source(args: { sourceReference: number; source?: { path: string } }): Promise<DapResponse> {
    return this.sendRequest('source', args);
  }

  // ── outbound requests ──────────────────────────────────────────────────

  private sendRequest(command: string, args?: any, timeoutMs: number = 5000, silentError: boolean = false): Promise<DapResponse> {
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
      this.trafficSubject.next(request);
    });
  }

  /**
   * @internal Outbound proxy for internal objects and managers
   */
  public sendRequestInternal(command: string, args?: any): Promise<DapResponse> {
    return this.sendRequest(command, args);
  }

  public onEvent(): Observable<DapEvent> {
    return this.eventSubject.asObservable();
  }

  // ── internal sub-manager routing helpers ───────────────────────────────

  /**
   * @internal Exposes synthetic event generation for managers.
   */
  public emitSyntheticEvent(event: DapEvent): void {
    this.eventSubject.next(event);
  }

  /**
   * @internal Exposes execution state modifications.
   */
  public setExecutionStateInternal(state: ExecutionState): void {
    this.executionStateSubject.next(state);
  }

  /**
   * @internal Exposes state transition guard clearing.
   */
  public clearStateTransitionGuardInternal(): void {
    this.clearStateTransitionGuard();
  }

  /**
   * @internal Exposes control state tracking.
   */
  public setCommandInFlightInternal(inFlight: boolean): void {
    this.commandInFlightSubject.next(inFlight);
  }

  // ── Message & Transport Handling ───────────────────────────────────

  private handleIncomingMessage(msg: any): void {
    this.trafficSubject.next(msg);

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

    this.eventSubject.next({
      seq: 0,
      type: 'event',
      event: '_transportError',
      body: { reason: 'error', message: errMsg }
    });
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
    this.threadManager.clearAll();
    this.breakpointManager.clearAll();
    this.processInfoSubject.next(null);
    this.clearStateTransitionGuard();
    this.commandInFlightSubject.next(false);
  }

  private handleResumptionState(allThreads: boolean, threadId?: number): void {
    this.threadManager.handleResumptionState(allThreads, threadId);
  }

  private handleStoppedEvent(event: DapEvent): void {
    this.executionStateSubject.next('stopped');
    this.clearStateTransitionGuard();
    this.commandInFlightSubject.next(false);
    
    const hitBps = event.body?.hitBreakpointIds || [];
    const isSystemStop = hitBps.some((id: number) => this.breakpointManager.isSystemBreakpoint(id));
    let stopReason = event.body?.description || event.body?.reason || 'paused';
    if (isSystemStop) {
      stopReason = 'Paused at entry (main)';
    }

    this.threadManager.handleStoppedEvent(event, isSystemStop, stopReason);
  }

  private handleContinuedEvent(event: DapEvent): void {
    this.handleResumptionState(
      event.body?.allThreadsContinued ?? true,
      event.body?.threadId
    );
  }

  private handleThreadEvent(event: DapEvent): void {
    this.threadManager.handleThreadEvent(event.body);
  }

  private handleBreakpointEvent(event: DapEvent): void {
    this.breakpointManager.handleBreakpointEvent(event);
  }

  private handleTransportEvent(event: DapEvent): void {
    switch (event.event) {
      case 'initialized':
        // The initialized event processing (launch + configurationDone) is managed by startSession()
        break;

      case 'stopped':
        this.handleStoppedEvent(event);
        break;

      case 'continued':
        this.handleContinuedEvent(event);
        break;

      case 'thread':
        this.handleThreadEvent(event);
        break;

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

      case 'breakpoint':
        this.handleBreakpointEvent(event);
        break;
    }

    // Forward processed event to external subscribers (Components, etc.)
    this.eventSubject.next(event);
  }

  // ── State Transition Guard ───────────────────────────────────────────────

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
}
