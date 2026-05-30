import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { DapRequest, DapResponse, DapEvent } from '../dap.types';
import { DapTransportService } from '../transport/dap-transport.service';

/**
 * Service responsible for request-response sequence bookkeeping, timeouts,
 * and dispatching diagnostic traffic for the active DAP session.
 */
@Injectable()
export class DapRequestBroker {
  private seq = 1;
  private readonly pendingRequests = new Map<
    number,
    {
      resolve: (response: DapResponse) => void;
      reject: (error: any) => void;
      silentError?: boolean;
    }
  >();

  private transport?: DapTransportService;
  private readonly eventSubject = new Subject<DapEvent>();
  private readonly trafficSubject = new Subject<any>();

  /**
   * Sets the active transport instance to use for outbound requests.
   */
  public setTransport(transport: DapTransportService): void {
    this.transport = transport;
  }

  /**
   * Returns the count of currently pending requests.
   */
  public get pendingRequestsCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Returns the next request sequence number.
   */
  public get currentSeq(): number {
    return this.seq;
  }

  /**
   * @internal Exposes the raw pending requests Map for diagnostic/unit test assertions.
   */
  public getPendingRequests(): Map<number, any> {
    return this.pendingRequests;
  }

  /**
   * Rejects all active pending requests with the specified error and clears the Map.
   * Useful during session reset, transport error, or disconnect events.
   */
  public clearPendingRequests(error: Error): void {
    for (const [seq, handler] of this.pendingRequests.entries()) {
      handler.reject(error);
      this.pendingRequests.delete(seq);
    }
  }

  /**
   * Dispatches a typed DAP request to the active transport, setting up a promise
   * resolved when the corresponding DAP response is received, or rejected if a timeout occurs.
   *
   * @param command The DAP command string (e.g. 'scopes', 'variables').
   * @param args The optional arguments object associated with the command.
   * @param timeoutMs The duration in milliseconds before timing out. Defaults to 5000ms.
   * @param silentError Whether to suppress synthetic error event emission on command failure.
   */
  public sendRequest(
    command: string,
    args?: any,
    timeoutMs: number = 5000,
    silentError: boolean = false
  ): Promise<DapResponse> {
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

      this.pendingRequests.set(currentSeq, {
        resolve: resolveWrapper,
        reject: rejectWrapper,
        silentError
      });

      transport.sendRequest(request);
      this.trafficSubject.next(request);
    });
  }

  /**
   * Processes an incoming response message, resolving the associated pending request.
   */
  public handleResponse(response: DapResponse): void {
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
  }

  /**
   * Returns a reactive stream emitting internal session warnings and errors.
   */
  public onEvent(): Observable<DapEvent> {
    return this.eventSubject.asObservable();
  }

  /**
   * Returns a reactive stream emitting outbound diagnostic traffic payloads.
   */
  public onTraffic(): Observable<any> {
    return this.trafficSubject.asObservable();
  }
}
