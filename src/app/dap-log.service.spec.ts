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

  it('should trim newlines in console logs', async () => {
    service.consoleLog('Message with newline\n', 'info');
    const logs = await firstValueFrom(service.consoleLogs$);
    expect(logs[0].message).toBe('Message with newline');
  });

  it('should append program logs', async () => {
    service.appendProgramLog('Program output', 'stdout');
    const logs = await firstValueFrom(service.programLogs$);
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Program output');
    expect(logs[0].category).toBe('stdout');
    expect(logs[0].level).toBe('info');
  });

  it('should clear all logs', async () => {
    service.consoleLog('Main', 'info');
    service.appendProgramLog('Program', 'stdout');
    service.clear();

    const consoleLogs = await firstValueFrom(service.consoleLogs$);
    const progLogs = await firstValueFrom(service.programLogs$);

    expect(consoleLogs.length).toBe(0);
    expect(progLogs.length).toBe(0);
  });
});
