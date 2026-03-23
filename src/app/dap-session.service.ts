import { Injectable, inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject, Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DapTransportService } from './dap-transport.service';
import { createTransport } from './transport.factory';
import { DapConfigService } from './dap-config.service';
import { DapRequest, DapResponse, DapEvent } from './dap.types';
import { FileTreeService } from './file-tree.service';
import { DapFileTreeService } from './dap-file-tree.service';

/** Execution State */
export type ExecutionState = 'idle' | 'starting' | 'running' | 'stopped' | 'terminated' | 'error';

@Injectable()
export class DapSessionService {
  private readonly configService = inject(DapConfigService);
  private seq = 1;
  private readonly pendingRequests = new Map<number, { resolve: (response: DapResponse) => void; reject: (error: any) => void }>();
  private messageSubscription?: Subscription;

  public readonly fileTree: FileTreeService;
  public capabilities: any = {};
  private transport?: DapTransportService;
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private transportStatusSubscription?: Subscription;

  /** Session-level event Subject, emitted after internal processing */
  private eventSubject = new Subject<DapEvent>();

  /** Current debug execution state */
  private executionStateSubject = new BehaviorSubject<ExecutionState>('idle');

  get executionState$(): Observable<ExecutionState> {
    return this.executionStateSubject.asObservable();
  }

  constructor() {
    this.fileTree = new DapFileTreeService(this);
  }


  /**
   * Get connection status Observable (false until transport is established)
   */
  get connectionStatus$(): Observable<boolean> {
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
  async startSession(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    if (!config.serverAddress) {
      throw new Error('Server address is empty');
    }

    // Create corresponding Transport instance based on configuration
    this.transport = createTransport(config.transportType);

    // Bridge transport connection status to the Session level
    this.transportStatusSubscription?.unsubscribe();
    this.transportStatusSubscription = this.transport.connectionStatus$.subscribe(
      status => this.connectionStatusSubject.next(status)
    );

    try {
      // Wait for the connection to be established
      await firstValueFrom(this.transport.connect(config.serverAddress));
    } catch (e) {
      throw new Error(`${config.transportType} connection failed`);
    }

    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }

    this.executionStateSubject.next('starting');

    this.messageSubscription = this.transport.onMessage().subscribe({
      next: (msg) => {
        if (msg.type === 'response') {
          const response = msg as DapResponse;
          const handler = this.pendingRequests.get(response.request_seq);
          if (handler) {
            this.pendingRequests.delete(response.request_seq);
            if (response.success) {
              handler.resolve(response);
            } else {
              handler.reject(new Error(response.message || `Command ${response.command} failed`));
            }
          }
        } else if (msg.type === 'event') {
          this.handleTransportEvent(msg as DapEvent);
        }
      },
      error: (err) => {
        console.error('DAP Session subscription error:', err);
        this.executionStateSubject.next('error');
        for (const [seq, handler] of this.pendingRequests.entries()) {
          handler.reject(err);
          this.pendingRequests.delete(seq);
        }
      },
      complete: () => {
        if (this.executionStateSubject.value !== 'idle') {
          console.warn('DAP Session unexpected disconnect (completed)');
          this.executionStateSubject.next('error');
          for (const [seq, handler] of this.pendingRequests.entries()) {
            handler.reject(new Error('Connection abruptly closed'));
            this.pendingRequests.delete(seq);
          }
        }
      }
    });

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
      supportsRunInTerminalRequest: false
    });
    this.capabilities = initResponse.body || {};

    // Step 2: Wait for initialized event
    await initializedPromise;

    // Step 3: Send launch/attach request (fire-and-forget, don't wait for response yet)
    // According to DAP spec, launch/attach response returns after configurationDone
    const launchPromise = this.launchOrAttach();

    // Step 4: Send configurationDone
    await this.sendRequest('configurationDone');

    // Step 5: Wait for launch/attach response (the Server will reply at this point)
    const launchResponse = await launchPromise;
    this.executionStateSubject.next('running');

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
      args: argsArray,
      stopAtBeginningOfMainSubprogram: true
    };

    return this.sendRequest(command, args);
  }

  /**
   * Disconnect the session calmly.
   */
  async disconnect(): Promise<void> {
    try {
      // 若狀態為 error 或 idle 則可能無須/無法送出正常的 disconnect 請求
      if (this.transport && this.executionStateSubject.value !== 'error' && this.executionStateSubject.value !== 'idle') {
        // Send disconnect request to DAP Server
        await this.sendRequest('disconnect', {
          restart: false,
          terminateDebuggee: true
        });
      }
    } catch (e) {
      console.warn('Failed to send disconnect request cleanly', e);
    } finally {
      this.reset();
    }
  }

  /**
   * Reset session completely to idle, without sending a DAP request.
   * Clears resources directly (e.g., used to return from error to idle safely).
   */
  reset(): void {
    // Stop receiving messages
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = undefined;
    }

    for (const [seq, handler] of this.pendingRequests.entries()) {
      handler.reject(new Error('Session reset'));
      this.pendingRequests.delete(seq);
    }

    this.transportStatusSubscription?.unsubscribe();
    this.transportStatusSubscription = undefined;
    this.transport?.disconnect();
    this.transport = undefined;
    this.connectionStatusSubject.next(false);
    this.executionStateSubject.next('idle');
  }


  /**
   * Terminate the debuggee.
   * If the adapter supports the terminate request, it is sent.
   * Otherwise, it falls back to a disconnect request with terminateDebuggee.
   */
  async terminate(): Promise<void> {
    if (this.capabilities?.supportsTerminateRequest) {
      try {
        await this.sendRequest('terminate');
        return;
      } catch (e) {
        console.warn('Terminate request failed, falling back to disconnect', e);
      }
    }

    // Fallback: Disconnect with termination
    await this.disconnect();
  }

  /**
   * Continue execution
   */
  async continue(): Promise<DapResponse> {
    // Note: threadId is currently hardcoded to 1, let DAP server decide (usually the stopped thread)
    return this.sendRequest('continue', { threadId: 1 });
  }

  /**
   * Step Over (Next)
   */
  async next(): Promise<DapResponse> {
    return this.sendRequest('next', { threadId: 1 });
  }

  /**
   * Step Into
   */
  async stepIn(): Promise<DapResponse> {
    return this.sendRequest('stepIn', { threadId: 1 });
  }

  /**
   * Step Out
   */
  async stepOut(): Promise<DapResponse> {
    return this.sendRequest('stepOut', { threadId: 1 });
  }

  /**
   * Pause execution
   */
  async pause(): Promise<DapResponse> {
    return this.sendRequest('pause', { threadId: 1 });
  }

  /**
   * Get thread list
   */
  async threads(): Promise<DapResponse> {
    return this.sendRequest('threads');
  }

  /**
   * Get stack trace of a specific thread
   * @param threadId Thread ID
   */
  async stackTrace(threadId: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('stackTrace', { threadId });
  }

  /**
   * Get scopes for a specific stack frame
   * @param frameId Stack frame ID
   */
  async scopes(frameId: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('scopes', { frameId });
  }

  /**
   * Get variables for a specific scope
   * @param variablesReference Variables Reference (from scopes response)
   */
  async variables(variablesReference: number): Promise<DapResponse> {
    this.ensureStopped();
    return this.sendRequest('variables', { variablesReference });
  }

  /**
   * Wrapper for sending a request and waiting for its response.
   * @param command DAP command name
   * @param args DAP command arguments (optional)
   * @param timeoutMs Timeout in milliseconds (default 5000ms)
   */
  sendRequest(command: string, args?: any, timeoutMs: number = 5000): Promise<DapResponse> {
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
          reject(new Error(`DAP request '${command}' timed out after ${timeoutMs}ms`));
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

      this.pendingRequests.set(currentSeq, { resolve: resolveWrapper, reject: rejectWrapper });
      transport.sendRequest(request);
    });
  }

  /**
   * Provides the session-level event stream (pre-processed by the Session)
   */
  onEvent(): Observable<DapEvent> {
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

      case 'stopped':
        this.executionStateSubject.next('stopped');
        break;

      case 'continued':
        this.executionStateSubject.next('running');
        break;

      case 'terminated':
      case 'exited':
        this.executionStateSubject.next('terminated');
        break;
    }

    // Forward processed event to external subscribers (Components, etc.)
    this.eventSubject.next(event);
  }
}
