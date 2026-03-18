import { Injectable } from '@angular/core';
import { Observable, Subject, Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DapTransportService } from './dap-transport.service';
import { DapConfigService } from './dap-config.service';
import { DapRequest, DapResponse, DapEvent } from './dap.types';

@Injectable()
export class DapSessionService {
  private seq = 1;
  private pendingRequests = new Map<number, { resolve: (response: DapResponse) => void; reject: (error: any) => void }>();
  private messageSubscription?: Subscription;

  constructor(
    private transportStatus: DapTransportService,
    private configService: DapConfigService
  ) { }

  /**
   * 取得 Transport 層的連線狀態 Observable
   */
  get connectionStatus$(): Observable<boolean> {
    return this.transportStatus.connectionStatus$;
  }

  /**
   * 初始化 Session。這會先建立底層連線，接著開始監聽 Message 並發送 initialize 請求。
   */
  async initializeSession(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    if (!config.serverAddress) {
      throw new Error('Server address is empty');
    }

    try {
      // 等待連線建立完成
      await firstValueFrom(this.transportStatus.connect(config.serverAddress));
    } catch (e) {
      throw new Error(`websocket 連線失敗`);
    }

    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }

    this.messageSubscription = this.transportStatus.onMessage().subscribe({
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
        }
      },
      error: (err) => {
        console.error('DAP Session subscription error:', err);
        // 若有未回應的請求，全部清除並 reject
        for (const [seq, handler] of this.pendingRequests.entries()) {
          handler.reject(err);
          this.pendingRequests.delete(seq);
        }
      }
    });

    // 1. 建立 DAP initialize 請求
    const initResponse = await this.sendRequest('initialize', {
      clientID: 'gdb-frontend',
      clientName: 'Angular GDB/DAP Frontend',
      adapterID: 'gdb', // 也可以支援多個 adapter，這裡暫時寫死
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: true,
      supportsRunInTerminalRequest: false
    });

    return initResponse;
  }

  /**
   * 根據組態決定呼叫 launch 或 attach
   */
  async launchOrAttach(): Promise<DapResponse> {
    const config = this.configService.getConfig();
    const command = config.launchMode;

    // 將 args 字串拆分為陣列
    const argsArray = config.programArgs ? config.programArgs.split(' ').filter(a => a.length > 0) : [];

    const args = {
      program: config.executablePath,
      cwd: config.sourcePath || undefined,
      args: argsArray,
      stopAtEntry: false // 預設不在進入點停下，可之後依需求做設定
    };

    return this.sendRequest(command, args);
  }

  /**
   * 告知 DAP Server 前端設定完畢，可以開始執行了
   */
  async configurationDone(): Promise<DapResponse> {
    return this.sendRequest('configurationDone');
  }

  /**
   * 中斷連線
   */
  async disconnect(): Promise<void> {
    try {
      if (this.transportStatus.connectionStatus$) {
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

      this.transportStatus.disconnect();
    }
  }

  /**
   * 封裝發送 Request 並等待對應 Response 的邏輯
   * @param command DAP 指令名稱
   * @param args DAP 指令的 arguments (optional)
   * @param timeoutMs 逾時時間 (預設 5000ms)
   */
  sendRequest(command: string, args?: any, timeoutMs: number = 5000): Promise<DapResponse> {
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
      this.transportStatus.sendRequest(request);
    });
  }

  /**
   * 開放取得 Session 事件串流
   */
  onEvent(): Observable<DapEvent> {
    return this.transportStatus.onEvent();
  }
}
