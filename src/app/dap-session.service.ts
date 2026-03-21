import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DapTransportService } from './dap-transport.service';
import { createTransport } from './transport.factory';
import { DapConfigService } from './dap-config.service';
import { DapRequest, DapResponse, DapEvent } from './dap.types';
import { FileTreeService } from './file-tree.service';
import { DapFileTreeService } from './dap-file-tree.service';

/** 偵錯執行狀態 */
export type ExecutionState = 'idle' | 'starting' | 'running' | 'stopped' | 'terminated';

@Injectable()
export class DapSessionService {
  private seq = 1;
  private pendingRequests = new Map<number, { resolve: (response: DapResponse) => void; reject: (error: any) => void }>();
  private messageSubscription?: Subscription;

  public readonly fileTree: FileTreeService;
  public capabilities: any = {};
  private transport?: DapTransportService;
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private transportStatusSubscription?: Subscription;

  /** Session 層級的事件 Subject，經過內部處理後再發出 */
  private eventSubject = new Subject<DapEvent>();

  /** 當前偵錯執行狀態 */
  private executionStateSubject = new BehaviorSubject<ExecutionState>('idle');

  get executionState$(): Observable<ExecutionState> {
    return this.executionStateSubject.asObservable();
  }

  constructor(
    private configService: DapConfigService
  ) {
    this.fileTree = new DapFileTreeService(this);
  }


  /**
   * 取得連線狀態 Observable（在 transport 建立前為 false）
   */
  get connectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  /**
   * 啟動完整的 DAP Session。
   * 
   * 遵循 DAP 協議標準訊息流：
   * 1. 建立底層連線 (Transport)
   * 2. 發送 initialize request
   * 3. 等待 initialized event（內部自動處理 configurationDone）
   * 4. 發送 launch/attach request（response 會在 configurationDone 之後才回來）
   */
  async startSession(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    if (!config.serverAddress) {
      throw new Error('Server address is empty');
    }

    // 根據組態建立對應的 Transport 實例
    this.transport = createTransport(config.transportType);

    // 橋接 transport 連線狀態至 Session 層級
    this.transportStatusSubscription?.unsubscribe();
    this.transportStatusSubscription = this.transport.connectionStatus$.subscribe(
      status => this.connectionStatusSubject.next(status)
    );

    try {
      // 等待連線建立完成
      await firstValueFrom(this.transport.connect(config.serverAddress));
    } catch (e) {
      throw new Error(`${config.transportType} 連線失敗`);
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
        for (const [seq, handler] of this.pendingRequests.entries()) {
          handler.reject(err);
          this.pendingRequests.delete(seq);
        }
      }
    });

    const initializedPromise = firstValueFrom(
      this.eventSubject.pipe(filter(e => e.event === 'initialized'))
    );

    // Step 1: 發送 initialize request
    const initResponse = await this.sendRequest('initialize', {
      clientID: 'gdb-frontend',
      clientName: 'Angular GDB/DAP Frontend',
      adapterID: 'gdb',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: true,
      supportsRunInTerminalRequest: false
    });
    this.capabilities = initResponse.body || {};

    // Step 2: 等待 initialized event
    await initializedPromise;

    // Step 3: 發送 launch/attach request（先送出，不等 response）
    // 根據 DAP 規範，launch/attach 的 response 會在 configurationDone 之後才回來
    const launchPromise = this.launchOrAttach();

    // Step 4: 發送 configurationDone
    await this.sendRequest('configurationDone');

    // Step 5: 等待 launch/attach response（此時 Server 才會回覆）
    const launchResponse = await launchPromise;
    this.executionStateSubject.next('running');

    return launchResponse;
  }

  /**
   * 根據組態決定呼叫 launch 或 attach（內部使用）
   */
  private async launchOrAttach(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    const command = config.launchMode;

    const argsArray = config.programArgs ? config.programArgs.split(' ').filter(a => a.length > 0) : [];

    const args = {
      program: config.executablePath,
      cwd: config.sourcePath || undefined,
      args: argsArray,
      stopOnEntry: true
    };

    return this.sendRequest(command, args);
  }

  /**
   * 中斷連線
   */
  async disconnect(): Promise<void> {
    try {
      if (this.transport) {
        // 先發送 disconnect request 給 DAP Server
        await this.sendRequest('disconnect', {
          restart: false,
          terminateDebuggee: true
        });
      }
    } catch (e) {
      console.warn('Failed to send disconnect request cleanly', e);
    } finally {
      // 停止接收訊息
      if (this.messageSubscription) {
        this.messageSubscription.unsubscribe();
        this.messageSubscription = undefined;
      }

      for (const [seq, handler] of this.pendingRequests.entries()) {
        handler.reject(new Error('Session stopped'));
        this.pendingRequests.delete(seq);
      }

      this.transportStatusSubscription?.unsubscribe();
      this.transportStatusSubscription = undefined;
      this.transport?.disconnect();
      this.transport = undefined;
      this.connectionStatusSubject.next(false);
      this.executionStateSubject.next('idle');
    }
  }

  /**
   * 繼續執行 (Continue)
   */
  async continue(): Promise<DapResponse> {
    // 註：目前暫不指定 threadId，由 DAP Server 決定 (通常為當前停止的 thread)
    return this.sendRequest('continue', { threadId: 1 });
  }

  /**
   * 單步執行 (Step Over / Next)
   */
  async next(): Promise<DapResponse> {
    return this.sendRequest('next', { threadId: 1 });
  }

  /**
   * 進入函式 (Step Into)
   */
  async stepIn(): Promise<DapResponse> {
    return this.sendRequest('stepIn', { threadId: 1 });
  }

  /**
   * 跳出函式 (Step Out)
   */
  async stepOut(): Promise<DapResponse> {
    return this.sendRequest('stepOut', { threadId: 1 });
  }

  /**
   * 暫停執行 (Pause)
   */
  async pause(): Promise<DapResponse> {
    return this.sendRequest('pause', { threadId: 1 });
  }

  /**
   * 封裝發送 Request 並等待對應 Response 的邏輯
   * @param command DAP 指令名稱
   * @param args DAP 指令的 arguments (optional)
   * @param timeoutMs 逾時時間 (預設 5000ms)
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
   * 開放取得 Session 層級事件串流（已經過 Session 內部處理）
   */
  onEvent(): Observable<DapEvent> {
    return this.eventSubject.asObservable();
  }

  // ── Session 層級事件處理 ─────────────────────────────────────────

  /**
   * 處理來自 Transport 層的原始 DAP 事件。
   * Session 先做內部狀態更新與必要的自動回應，處理完畢後再轉發給外部訂閱者。
   */
  private handleTransportEvent(event: DapEvent): void {
    switch (event.event) {
      case 'initialized':
        // initialized 事件的後續處理（launch + configurationDone）由 startSession() 流程控制
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

    // 處理完畢後，將事件轉發給外部訂閱者（Component 等）
    this.eventSubject.next(event);
  }
}
