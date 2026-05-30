import { Injectable, inject, Injector } from '@angular/core';
import { Observable, Subject, BehaviorSubject, Subscription, firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
import { DapTransportService } from '../transport/dap-transport.service';
import { TransportFactoryService } from '../transport/transport-factory.service';
import { DapConfigService } from './dap-config.service';
import { DapRequest, DapResponse, DapEvent, DapCapabilities } from '../dap.types';
import { DapBreakpointManager } from './dap-breakpoint-manager.service';
import { DapThreadManager } from './dap-thread-manager.service';
import { DapRequestBroker } from './dap-request-broker.service';
import { ExecutionState, DapFatalException } from './dap-session.service';
import { DapExecutionController } from './dap-execution-controller.service';

/**
 * Service responsible for the connection, setup handshake, initial capabilities exchange,
 * and the main debug session state machine of GDB/LLDB.
 */
@Injectable()
export class DapSessionLifecycle {
  private readonly configService = inject(DapConfigService);
  private readonly transportFactory = inject(TransportFactoryService);
  private readonly breakpointManager = inject(DapBreakpointManager);
  private readonly threadManager = inject(DapThreadManager);
  private readonly requestBroker = inject(DapRequestBroker);
  private readonly injector = inject(Injector);

  private messageSubscription?: Subscription;
  private transportStatusSubscription?: Subscription;
  private transport: DapTransportService;

  private readonly connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public readonly connectionStatus$ = this.connectionStatusSubject.asObservable();

  private readonly executionStateSubject = new BehaviorSubject<ExecutionState>('disconnected');
  public readonly executionState$ = this.executionStateSubject.asObservable();

  private readonly eventSubject = new Subject<DapEvent>();
  public readonly event$ = this.eventSubject.asObservable();

  private readonly trafficSubject = new Subject<any>();
  public readonly onTraffic$ = this.trafficSubject.asObservable();

  private readonly processInfoSubject = new BehaviorSubject<{ name: string; systemProcessId?: number } | null>(null);
  public readonly processInfo$ = this.processInfoSubject.asObservable();

  public capabilities: DapCapabilities = {};

  public get executionState(): ExecutionState {
    return this.executionStateSubject.value;
  }

  public get connectionStatus(): boolean {
    return this.connectionStatusSubject.value;
  }

  private get executionController(): DapExecutionController {
    return this.injector.get(DapExecutionController);
  }

  public constructor() {
    const config = this.configService.getConfig();
    this.transport = this.transportFactory.createTransport(config.transportType);
    this.requestBroker.setTransport(this.transport);

    // Bridge transport connection status to the Session level
    this.transportStatusSubscription = this.transport.connectionStatus$.subscribe(
      status => this.connectionStatusSubject.next(status)
    );

    // Forward events and diagnostic traffic from the broker to our subjects
    this.requestBroker.onEvent().subscribe(event => this.eventSubject.next(event));
    this.requestBroker.onTraffic().subscribe(traffic => this.trafficSubject.next(traffic));
  }

  public destroy(): void {
    this.closeTransport();
    this.transportStatusSubscription?.unsubscribe();
  }

  public closeTransport(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = undefined;
    }
    this.transport.disconnect();
    this.connectionStatusSubject.next(false);
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
      this.executionStateSubject.next('error');
      throw new Error(reason);
    }

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

  public async initializeSession(): Promise<DapResponse> {
    const config = this.configService.getConfig();

    this.executionStateSubject.next('starting');

    const initializedPromise = firstValueFrom(
      this.eventSubject.pipe(filter(e => e.event === 'initialized'))
    );

    const initResponse = await this.requestBroker.sendRequest('initialize', {
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

    const launchPromise = this.launchOrAttach();

    await initializedPromise;

    await this.breakpointManager.resyncAllBreakpointsInternal();

    if (config.stopOnEntry) {
      await this.breakpointManager.setFunctionBreakpoints([{ name: 'main' }], true);
    }

    await this.requestBroker.sendRequest('configurationDone');

    const launchResponse = await launchPromise;
    this.executionStateSubject.next('running');
    void this.threadManager.fetchThreads();

    return launchResponse;
  }

  public async startSession(): Promise<DapResponse> {
    this.assertState(['disconnected', 'idle', 'error'], 'startSession');
    await this.connectTransport();

    const config = this.configService.getConfig();
    this.executionStateSubject.next('starting');

    if (config.setupMode === 'new') {
      await this.createNewSession();
    } else {
      await this.openExistingSession();
    }
    return this.initializeSession();
  }

  private async launchOrAttach(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    const command = config.launchMode;
    const argsArray = config.programArgs ? config.programArgs.split(' ').filter(a => a.length > 0) : [];
    const args = {
      program: config.executablePath,
      cwd: config.sourcePath || undefined,
      args: argsArray
    };
    return this.requestBroker.sendRequest(command, args);
  }

  public async disconnect(options: { terminateDebuggee?: boolean } = {}): Promise<void> {
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
        await this.requestBroker.sendRequest('disconnect', {
          terminateDebuggee: options.terminateDebuggee ?? true
        }, 2000);
      }
    } catch (e) {
      console.warn('Failed to send disconnect request cleanly', e);
    }
  }

  public reset(): void {
    this.requestBroker.clearPendingRequests(new Error('Session reset'));
    this.executionController.setCommandInFlight(false);
    this.clearSessionData();
  }

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

        await this.requestBroker.sendRequest('terminate');
        await terminatedPromise;
        break;
      }
    }
  }

  public assertState(allowedStates: ExecutionState[], actionName: string): void {
    const currentState = this.executionStateSubject.value;
    if (!allowedStates.includes(currentState)) {
      throw new DapFatalException(
        `Cannot perform '${actionName}' from execution state '${currentState}'. Allowed states: ${allowedStates.join(', ')}`
      );
    }
  }

  public async start(): Promise<DapResponse> {
    this.assertState(['disconnected', 'idle', 'error'], 'start');
    return this.initializeSession();
  }

  public async restart(): Promise<void> {
    const state = this.executionStateSubject.value;
    if (state === 'starting' || state === 'idle') {
      return;
    }

    if (state === 'running' || state === 'stopped') {
      await this.stop();
    }
    await this.initializeSession();
  }

  public emitSyntheticEvent(event: DapEvent): void {
    this.eventSubject.next(event);
  }

  public setExecutionState(state: ExecutionState): void {
    this.executionStateSubject.next(state);
  }

  public handleIncomingMessage(msg: any): void {
    this.trafficSubject.next(msg);

    if (msg.channel === 'setup') {
      this.eventSubject.next(msg as any);
      return;
    }

    if (msg.type === 'response') {
      this.requestBroker.handleResponse(msg as DapResponse);
    } else if (msg.type === 'event') {
      this.handleTransportEvent(msg as DapEvent);
    }
  }

  public handleIncomingTransportError(err: any): void {
    const errMsg = err?.message || 'Unknown transport error';

    this.eventSubject.next({
      seq: 0,
      type: 'event',
      event: '_transportError',
      body: { reason: 'error', message: errMsg }
    });
    this.closeTransport();
    this.executionStateSubject.next('error');
    this.executionController.setCommandInFlight(false);
    this.requestBroker.clearPendingRequests(err);
    this.clearSessionData();
  }

  public handleIncomingTransportComplete(): void {
    if (this.executionStateSubject.value !== 'idle' && this.executionStateSubject.value !== 'disconnected') {
      this.handleIncomingTransportError(new Error("Connection to Debug session was unexpectedly closed"));
    }
  }

  public clearSessionData(): void {
    this.threadManager.clearAll();
    this.breakpointManager.clearAll();
    this.processInfoSubject.next(null);
    this.executionController.clearStateTransitionGuard();
    this.executionController.setCommandInFlight(false);
  }

  private handleStoppedEvent(event: DapEvent): void {
    this.executionStateSubject.next('stopped');
    this.executionController.clearStateTransitionGuard();
    this.executionController.setCommandInFlight(false);

    const hitBps = event.body?.hitBreakpointIds || [];
    const isSystemStop = hitBps.some((id: number) => this.breakpointManager.isSystemBreakpoint(id));
    let stopReason = event.body?.description || event.body?.reason || 'paused';
    if (isSystemStop) {
      stopReason = 'Paused at entry (main)';
    }

    this.threadManager.handleStoppedEvent(event, isSystemStop, stopReason);
  }

  private handleContinuedEvent(event: DapEvent): void {
    this.threadManager.handleResumptionState(
      event.body?.allThreadsContinued ?? true,
      event.body?.threadId
    );
  }

  private handleTransportEvent(event: DapEvent): void {
    switch (event.event) {
      case 'initialized':
        break;

      case 'stopped':
        this.handleStoppedEvent(event);
        break;

      case 'continued':
        this.handleContinuedEvent(event);
        break;

      case 'thread':
        this.threadManager.handleThreadEvent(event.body);
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
        void this.disconnect();
        break;
      }

      case 'process':
        this.processInfoSubject.next({
          name: event.body?.name,
          systemProcessId: event.body?.systemProcessId
        });
        break;

      case 'breakpoint':
        this.breakpointManager.handleBreakpointEvent(event);
        break;
    }

    // Forward processed event to external subscribers (Components, etc.)
    this.eventSubject.next(event);
  }
}
