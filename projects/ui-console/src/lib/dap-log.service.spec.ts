import { DapLogService } from './dap-log.service';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';

describe('DapLogService', () => {
  let service: DapLogService;

  beforeEach(() => {
    service = new DapLogService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should append console logs', async () => {
    service.consoleLog('Test message', 'info', 'console');
    const logs = await firstValueFrom(service.consoleLogs$);
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Test message');
    expect(logs[0].category).toBe('console');
    expect(logs[0].level).toBe('info');
  });

  it('should split multi-line console logs', async () => {
    service.consoleLog('Line 1\nLine 2', 'info');
    const logs = await firstValueFrom(service.consoleLogs$);
    expect(logs.length).toBe(2);
    expect(logs[0].message).toBe('Line 1');
    expect(logs[1].message).toBe('Line 2');
  });

  it('should split multi-line program logs and pop trailing empty line', async () => {
    service.appendProgramLog('Output 1\nOutput 2\n', 'stdout');
    const logs = await firstValueFrom(service.programLogs$);
    expect(logs.length).toBe(2);
    expect(logs[0].message).toBe('Output 1');
    expect(logs[1].message).toBe('Output 2');
  });

  it('should filter out empty lines (QC Item 1)', async () => {
    // Console log with mixed empty lines and a single \n
    service.consoleLog('Line A\n\nLine B', 'info');
    service.consoleLog('\n', 'info');
    const logs = await firstValueFrom(service.consoleLogs$);
    expect(logs.length).toBe(2);
    expect(logs[0].message).toBe('Line A');
    expect(logs[1].message).toBe('Line B');
  });

  it('should handle console log trailing newline (QC Item 4)', async () => {
    service.consoleLog('Direct message\n', 'info');
    const logs = await firstValueFrom(service.consoleLogs$);
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Direct message');
  });

  it('should append DAP logs', async () => {
    const msg = { type: 'request', seq: 123, command: 'initialize' };
    service.appendDapLog(msg);
    const logs = await firstValueFrom(service.dapLogs$);
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('[123] initialize');
    expect(logs[0].category).toBe('dap');
    expect(logs[0].data).toEqual(msg);
  });

  it('should clear all logs', async () => {
    service.consoleLog('Main', 'info');
    service.appendProgramLog('Program', 'stdout');
    service.appendDapLog({ type: 'event', event: 'initialized' });
    service.clear();

    const consoleLogs = await firstValueFrom(service.consoleLogs$);
    const progLogs = await firstValueFrom(service.programLogs$);
    const dapLogs = await firstValueFrom(service.dapLogs$);

    expect(consoleLogs.length).toBe(0);
    expect(progLogs.length).toBe(0);
    expect(dapLogs.length).toBe(0);
  });

  it('should limit memory size to approx 1MB', async () => {
    // 256K chars * 2 bytes/char = 512KB
    const largeMessage = 'a'.repeat(256 * 1024);

    // Add 3 large messages (Total ~1.5MB)
    service.consoleLog(largeMessage, 'info');
    service.consoleLog(largeMessage, 'info');
    service.consoleLog(largeMessage, 'info');

    const logs = await firstValueFrom(service.consoleLogs$);

    // Should have pruned the first message to stay under 1MB
    // Total size should be ~1MB (2 messages)
    expect(logs.length).toBe(2);
  });
});
