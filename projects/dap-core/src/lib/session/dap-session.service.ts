import { Injectable, inject, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { DapConfigService } from './dap-config.service';
import { DapRequest, DapResponse, DapEvent, DisassembleArguments, StepArguments, DapDisassemblyResponse, ReadMemoryArguments, ReadMemoryResponse, WriteMemoryArguments, WriteMemoryResponse, DapCapabilities } from '../dap.types';
import { DapThreadSession } from './dap-thread';
import { DapBreakpointManager, VerifiedBreakpoint } from './dap-breakpoint-manager.service';
import { DapThreadManager } from './dap-thread-manager.service';
import { DapRequestSender } from './dap-request-sender.interface';
import { DapRequestBroker } from './dap-request-broker.service';
import { DapExecutionController } from './dap-execution-controller.service';
import { DapSessionLifecycle } from './dap-session-lifecycle.service';

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

/**
 * Orchestrating facade for the DAP session, coordinating sub-managers.
 * Restores SRP compliance by delegating lifecycle, execution, breakpoint,
 * and thread management tasks to focused sub-services.
 */
@Injectable()
export class DapSessionService implements OnDestroy, DapRequestSender {
  private readonly configService = inject(DapConfigService);
  
  // Sub-managers
  private readonly breakpointManager = inject(DapBreakpointManager);
  private readonly threadManager = inject(DapThreadManager);
  private readonly requestBroker = inject(DapRequestBroker);
  private readonly executionController = inject(DapExecutionController);
  private readonly lifecycle = inject(DapSessionLifecycle);

  /** Reactive stream of the current breakpoint state. */
  public readonly breakpoints$ = this.breakpointManager.breakpoints$;

  /** Reactive stream of all active threads. */
  public readonly threads$ = this.threadManager.threads$;

  /** Reactive stream of the active thread. */
  public readonly activeThread$ = this.threadManager.activeThread$;

  /** Reactive stream of GDB process information. */
  public readonly processInfo$ = this.lifecycle.processInfo$;

  /** Opt-in diagnostic stream for raw DAP protocol traffic. */
  public readonly onTraffic$: Observable<any> = this.lifecycle.onTraffic$;

  /** Emits true while any execution-control command is in-flight */
  public readonly commandInFlight$ = this.executionController.commandInFlight$;

  public get capabilities(): DapCapabilities {
    return this.lifecycle.capabilities;
  }

  public set capabilities(caps: DapCapabilities) {
    this.lifecycle.capabilities = caps;
  }

  public get executionState$(): Observable<ExecutionState> {
    return this.lifecycle.executionState$;
  }

  public get threadsList(): DapThreadSession[] {
    return this.threadManager.threadsList;
  }

  public get executionState(): ExecutionState {
    return this.lifecycle.executionState;
  }

  // ── Compatibility Getters & Setters for Legacy Tests ─────────────────

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

  /** @internal Getter for backward compatibility in unit tests */
  public get executionStateSubject() {
    return (this.lifecycle as any).executionStateSubject;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get commandInFlightSubject() {
    return (this.executionController as any).commandInFlightSubject;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get eventSubject() {
    return (this.lifecycle as any).eventSubject;
  }

  /** @internal Getter for backward compatibility in unit tests */
  public get transport() {
    return (this.lifecycle as any).transport;
  }

  /** @internal Setter for backward compatibility in unit tests */
  public set transport(t: any) {
    (this.lifecycle as any).transport = t;
  }

  public constructor() {}

  public ngOnDestroy(): void {
    this.lifecycle.destroy();
  }

  /**
   * Get connection status Observable (false until transport is established)
   */
  public get connectionStatus$(): Observable<boolean> {
    return this.lifecycle.connectionStatus$;
  }

  /**
   * Establishes the underlying connection to the debug transport (e.g., WebSocket).
   */
  public connectTransport(): Promise<void> {
    return this.lifecycle.connectTransport();
  }

  /**
   * Sends the 'new-session' command on the setup channel and awaits session-ready.
   */
  public createNewSession(): Promise<void> {
    return this.lifecycle.createNewSession();
  }

  /**
   * Sends the 'open-session' command on the setup channel and awaits session-ready.
   */
  public openExistingSession(): Promise<void> {
    return this.lifecycle.openExistingSession();
  }

  /**
   * Performs the DAP session handshake and complete initialization sequence.
   */
  public initializeSession(): Promise<DapResponse> {
    return this.lifecycle.initializeSession();
  }

  /**
   * Starts a complete DAP Session.
   */
  public async startSession(): Promise<DapResponse> {
    this.lifecycle.assertState(['disconnected', 'idle', 'error'], 'startSession');
    await this.connectTransport();

    const config = this.configService.getConfig();
    this.setExecutionStateInternal('starting');

    if (config.setupMode === 'new') {
      await this.createNewSession();
    } else {
      await this.openExistingSession();
    }
    return this.initializeSession();
  }

  /**
   * Public API for stopping the debug session.
   */
  public stop(): Promise<void> {
    return this.lifecycle.stop();
  }

  /**
   * Public API to start the DAP protocol handshake sequence.
   */
  public start(): Promise<DapResponse> {
    return this.lifecycle.start();
  }

  /**
   * Public API for restarting the debug session.
   */
  public async restart(): Promise<void> {
    const state = this.executionState;
    if (state === 'starting' || state === 'idle') {
      return;
    }

    if (state === 'running' || state === 'stopped') {
      await this.stop();
    }
    await this.initializeSession();
  }

  /**
   * Disconnect the session calmly.
   */
  public disconnect(options: { terminateDebuggee?: boolean } = {}): Promise<void> {
    return this.lifecycle.disconnect(options);
  }

  // ── Execution Control Commands ──────────────────────────────────────

  public continue(): Promise<DapResponse> {
    return this.executionController.continue();
  }

  public next(): Promise<DapResponse> {
    return this.executionController.next();
  }

  public stepIn(): Promise<DapResponse> {
    return this.executionController.stepIn();
  }

  public stepOut(): Promise<DapResponse> {
    return this.executionController.stepOut();
  }

  public nextInstruction(): Promise<DapResponse> {
    return this.executionController.nextInstruction();
  }

  public stepInInstruction(): Promise<DapResponse> {
    return this.executionController.stepInInstruction();
  }

  /**
   * Pause execution
   */
  public pause(): Promise<DapResponse> {
    return this.executionController.pause();
  }

  // ── delegated Manager Methods ──────────────────────────────────────────

  public setBreakpoints(sourcePath: string, lines: number[]): Promise<VerifiedBreakpoint[]> {
    return this.breakpointManager.setBreakpoints(sourcePath, lines);
  }

  public setFunctionBreakpoints(breakpoints: { name: string; condition?: string }[], isSystem = false): Promise<any[]> {
    return this.breakpointManager.setFunctionBreakpoints(breakpoints, isSystem);
  }

  public toggleBreakpoint(sourcePath: string, line: number): Promise<void> {
    return this.breakpointManager.toggleBreakpoint(sourcePath, line);
  }

  public toggleBreakpointEnabled(sourcePath: string, line: number): Promise<void> {
    return this.breakpointManager.toggleBreakpointEnabled(sourcePath, line);
  }

  public removeBreakpoint(sourcePath: string, line: number): Promise<void> {
    return this.breakpointManager.removeBreakpoint(sourcePath, line);
  }

  public resyncAllBreakpointsInternal(): Promise<void> {
    return this.breakpointManager.resyncAllBreakpointsInternal();
  }

  public fetchThreads(): Promise<void> {
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
    if (this.executionState !== 'stopped') {
      throw new Error(`Invalid state: operation requires the execution to be 'stopped', but current state is '${this.executionState}'`);
    }
  }

  public scopes(frameId: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('scopes', { frameId });
  }

  public variables(variablesReference: number): Promise<DapResponse> {
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

  public readMemory(args: ReadMemoryArguments): Promise<ReadMemoryResponse> {
    this.ensureStopped();
    return this.sendRequest('readMemory', args) as Promise<ReadMemoryResponse>;
  }

  public writeMemory(args: WriteMemoryArguments): Promise<WriteMemoryResponse> {
    this.ensureStopped();
    return this.sendRequest('writeMemory', args) as Promise<WriteMemoryResponse>;
  }

  public async cancelRequest(requestId: number): Promise<void> {
    if (!this.capabilities?.supportsCancelRequest) {
      return;
    }
    if (this.executionState !== 'idle' &&
      this.executionState !== 'disconnected' &&
      this.executionState !== 'error') {
      try {
        await this.sendRequest('cancel', { requestId });
      } catch (e) {
        // Ignored; typically means adapter rejected the cancel or already completed
      }
    }
  }

  public evaluate(expression: string, frameId?: number): Promise<DapResponse> {
    const TIMEOUT_MS = 30_000;
    const expectedSeq = this.requestBroker.currentSeq;
    const evaluatePromise = this.sendRequest('evaluate', { expression, frameId, context: 'repl' }, 35000, true);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void this.cancelRequest(expectedSeq);
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

  public loadedSources(): Promise<DapResponse> {
    return this.sendRequest('loadedSources', {});
  }

  public source(args: { sourceReference: number; source?: { path: string } }): Promise<DapResponse> {
    return this.sendRequest('source', args);
  }

  // ── outbound requests ──────────────────────────────────────────────────

  /**
   * Dispatches a DAP request to the debug adapter using the extracted broker.
   */
  public sendRequest(command: string, args?: any, timeoutMs: number = 5000, silentError: boolean = false): Promise<DapResponse> {
    return this.requestBroker.sendRequest(command, args, timeoutMs, silentError);
  }

  /**
   * @internal Outbound proxy for internal objects and managers
   */
  public sendRequestInternal(command: string, args?: any): Promise<DapResponse> {
    return this.sendRequest(command, args);
  }

  public onEvent(): Observable<DapEvent> {
    return this.lifecycle.event$;
  }

  // ── internal sub-manager routing helpers ───────────────────────────────

  /**
   * @internal Exposes synthetic event generation for managers.
   */
  public emitSyntheticEvent(event: DapEvent): void {
    this.lifecycle.emitSyntheticEvent(event);
  }

  /**
   * @internal Exposes execution state modifications.
   */
  public setExecutionStateInternal(state: ExecutionState): void {
    this.lifecycle.setExecutionState(state);
  }

  /**
   * @internal Exposes state transition guard clearing.
   */
  public clearStateTransitionGuardInternal(): void {
    this.executionController.clearStateTransitionGuard();
  }

  /**
   * @internal Exposes control state tracking.
   */
  public setCommandInFlightInternal(inFlight: boolean): void {
    this.executionController.setCommandInFlight(inFlight);
  }

  /**
   * @internal Exposes incoming message handling for legacy tests.
   */
  public handleIncomingMessage(msg: any): void {
    this.lifecycle.handleIncomingMessage(msg);
  }

  /**
   * @internal Exposes incoming transport error handling for legacy tests.
   */
  public handleIncomingTransportError(err: any): void {
    this.lifecycle.handleIncomingTransportError(err);
  }

  /**
   * @internal Exposes incoming transport completion handling for legacy tests.
   */
  public handleIncomingTransportComplete(): void {
    this.lifecycle.handleIncomingTransportComplete();
  }

  /**
   * @internal Exposes transport event handling for legacy tests.
   */
  public handleTransportEvent(event: DapEvent): void {
    (this.lifecycle as any).handleTransportEvent(event);
  }
}
