import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LogEntry, LogCategory } from './dap.types';

@Injectable({
  providedIn: 'root'
})
export class DapLogService {
  private readonly consoleLogsSubject = new BehaviorSubject<LogEntry[]>([]);
  private readonly programLogsSubject = new BehaviorSubject<LogEntry[]>([]);

  /** Debugging Console Logs (System/DAP) */
  public readonly consoleLogs$: Observable<LogEntry[]> = this.consoleLogsSubject.asObservable();

  /** Program Output Logs (Stdout/Stderr) */
  public readonly programLogs$: Observable<LogEntry[]> = this.programLogsSubject.asObservable();

  /**
   * Append a log entry to the main console stream.
   * @param message Log message
   * @param level Log level ('info' or 'error')
   * @param category Log category (internal classification)
   */
  public consoleLog(message: string, level: 'info' | 'error' = 'info', category: LogCategory = 'console'): void {
    if (!message) return;
    const cleanMsg = this.trimNewline(message);

    this.consoleLogsSubject.next([
      ...this.consoleLogsSubject.value,
      {
        timestamp: new Date(),
        message: cleanMsg,
        category,
        level
      }
    ]);
  }

  /**
   * Append a log entry to the program output stream.
   * @param message Log message
   * @param category Log category (typically 'stdout' or 'stderr')
   */
  public appendProgramLog(message: string, category: LogCategory = 'stdout'): void {
    if (!message) return;
    const cleanMsg = this.trimNewline(message);
    const level = category === 'stderr' ? 'error' : 'info';

    this.programLogsSubject.next([
      ...this.programLogsSubject.value,
      {
        timestamp: new Date(),
        message: cleanMsg,
        category,
        level
      }
    ]);
  }

  /**
   * Clear all logs manually.
   */
  public clear(): void {
    this.consoleLogsSubject.next([]);
    this.programLogsSubject.next([]);
  }

  private trimNewline(msg: string): string {
    return msg.endsWith('\n') ? msg.slice(0, -1) : msg;
  }
}
