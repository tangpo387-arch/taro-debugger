import { DapThread, DapResponse, DapStackFrame } from '../dap.types';
import { DapSessionService } from './dap-session.service';

/**
 * Rich, object-oriented representation of a thread in the debug session.
 * Encapsulates thread-specific execution-scoped cache, request coalescing,
 * and standard thread details.
 */
export class DapThreadSession implements DapThread {
  public readonly id: number;
  public readonly name: string;

  private stackTraceCache: DapResponse | null = null;
  private stackTracePromise: Promise<DapResponse> | null = null;

  constructor(
    private readonly session: DapSessionService,
    thread: DapThread
  ) {
    this.id = thread.id;
    this.name = thread.name;
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
