import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LogEntry, LogCategory } from './dap.types';

@Injectable()
export class DapLogService {
  private readonly consoleLogsSubject = new BehaviorSubject<LogEntry[]>([]);
  private readonly programLogsSubject = new BehaviorSubject<LogEntry[]>([]);

  /** Debugging Console Logs (System/DAP) */
  public readonly consoleLogs$: Observable<LogEntry[]> = this.consoleLogsSubject.asObservable();

  /** Program Output Logs (Stdout/Stderr) */
  public readonly programLogs$: Observable<LogEntry[]> = this.programLogsSubject.asObservable();

  private readonly MAX_LOG_MEMORY_SIZE = 1 * 1024 * 1024; // 1MB (approximate)

  /**
   * Append a log entry to the main console stream.
   * @param message Log message
   * @param level Log level ('info' or 'error')
   * @param category Log category (internal classification)
   */
  public consoleLog(message: string, level: 'info' | 'error' = 'info', category: LogCategory = 'console', data?: any): void {
    if (!message) return;
    
    const lines = message.split(/\r?\n/);
    // Filter out trailing empty line caused by a final \n (mirrors appendProgramLog guard)
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    const now = new Date();
    const newEntries: LogEntry[] = lines
      .filter(line => line.length > 0) // QC Item 1: Filter out empty entries
      .map((line, index) => ({
        timestamp: now,
        message: line,
        category,
        level,
        // Only attach data to the first line to avoid redundant expansion UI
        data: index === 0 ? data : undefined,
      }));

    const newLogs: LogEntry[] = [
      ...this.consoleLogsSubject.value,
      ...newEntries
    ];

    this.consoleLogsSubject.next(this.limitMemorySize(newLogs));
  }

  /**
   * Append a log entry to the program output stream.
   * @param message Log message
   * @param category Log category (typically 'stdout' or 'stderr')
   */
  public appendProgramLog(message: string, category: LogCategory = 'stdout'): void {
    if (!message) return;

    const lines = message.split(/\r?\n/);
    // Filter out trailing empty lines caused by final \n
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    const now = new Date();
    const level: 'info' | 'error' = category === 'stderr' ? 'error' : 'info';
    const newEntries: LogEntry[] = lines
      .filter(line => line.length > 0) // QC Item 1: Filter out empty entries
      .map(line => ({
        timestamp: now,
        message: line,
        category,
        level
      }));

    const newLogs: LogEntry[] = [
      ...this.programLogsSubject.value,
      ...newEntries
    ];

    this.programLogsSubject.next(this.limitMemorySize(newLogs));
  }

  /**
   * Estimates memory size and trims oldest entries if limit is exceeded.
   */
  private limitMemorySize(logs: LogEntry[]): LogEntry[] {
    let totalSize = logs.reduce((acc, log) => acc + log.message.length * 2, 0);
    const result = [...logs];

    while (totalSize > this.MAX_LOG_MEMORY_SIZE && result.length > 1) {
      const removed = result.shift();
      if (removed) {
        totalSize -= removed.message.length * 2;
      }
    }

    return result;
  }

  /**
   * Clear all logs manually.
   */
  public clear(): void {
    this.consoleLogsSubject.next([]);
    this.programLogsSubject.next([]);
  }
}
