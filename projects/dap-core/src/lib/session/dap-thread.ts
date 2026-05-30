import { DapThread, DapResponse, DapStackFrame } from '../dap.types';
import { ExecutionState } from './dap-session.service';
import { DapRequestSender } from './dap-request-sender.interface';

export type DapThreadStatus = 'running' | 'stopped' | 'exited';

/**
 * Rich, object-oriented representation of a thread in the debug session.
 * Encapsulates thread-specific execution-scoped cache, request coalescing,
 * and standard thread details.
 */
export class DapThreadSession implements DapThread {
  public readonly id: number;
  public readonly name: string;

  private _status: DapThreadStatus = 'running';
  private _stopReason: string | null = null;

  /**
   * Get the current status of the thread ('running' | 'stopped' | 'exited').
   */
  public get status(): DapThreadStatus {
    return this._status;
  }

  /**
   * Updates the thread status.
   */
  public setStatus(status: DapThreadStatus): void {
    this._status = status;
    if (status === 'running' || status === 'exited') {
      this._stopReason = null;
    }
  }

  /**
   * Get the stop reason of the thread.
   */
  public get stopReason(): string | null {
    return this._stopReason;
  }

  /**
   * Set the stop reason of the thread.
   */
  public setStopReason(reason: string | null): void {
    this._stopReason = reason;
  }

  private stackTraceCache: DapResponse | null = null;
  private stackTracePromise: Promise<DapResponse> | null = null;

  constructor(
    private readonly session: DapRequestSender,
    thread: DapThread
  ) {
    this.id = thread.id;
    this.name = thread.name;

    // Initialize status based on current session state
    this._status = this.session.executionState === 'stopped' ? 'stopped' : 'running';
  }

  public get cachedFrames(): DapStackFrame[] | undefined {
    return this.stackTraceCache?.body?.stackFrames;
  }

  public get isLoadingStackTrace(): boolean {
    return this.stackTracePromise !== null;
  }

  /**
   * Returns the cached stack trace or coalesces parallel requests into a single promise.
   */
  public async stackTrace(): Promise<DapStackFrame[]> {
    if (this.stackTraceCache) {
      return this.stackTraceCache.body?.stackFrames || [];
    }

    if (this.stackTracePromise) {
      const res = await this.stackTracePromise;
      return res.body?.stackFrames || [];
    }

    this.stackTracePromise = this.session.sendRequest('stackTrace', { threadId: this.id });

    try {
      const response = await this.stackTracePromise;
      if (response.success) {
        this.stackTraceCache = response;
      }
      this.stackTracePromise = null;
      return response.body?.stackFrames || [];
    } catch (err) {
      this.stackTracePromise = null;
      throw err;
    }
  }

  /**
   * Clears the execution-scoped cache when the target resumes.
   */
  public clearCache(): void {
    this.stackTraceCache = null;
    this.stackTracePromise = null;
  }
}
