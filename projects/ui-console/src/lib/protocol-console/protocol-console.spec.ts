import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProtocolConsoleComponent } from './protocol-console';
import { DapLogService } from '../dap-log.service';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogEntry } from '@taro/dap-core';
import { firstValueFrom } from 'rxjs';

describe('ProtocolConsoleComponent', () => {
  let component: ProtocolConsoleComponent;
  let fixture: ComponentFixture<ProtocolConsoleComponent>;
  let dapLogsSubject: BehaviorSubject<LogEntry[]>;

  const mockLogs: LogEntry[] = [
    {
      id: 1,
      timestamp: new Date(),
      message: '[1] initialize',
      category: 'dap',
      level: 'info',
      data: { type: 'request', command: 'initialize', seq: 1 }
    },
    {
      id: 2,
      timestamp: new Date(),
      message: '[1] initialize',
      category: 'dap',
      level: 'info',
      data: { type: 'response', command: 'initialize', request_seq: 1, success: true }
    }
  ];

  beforeEach(async () => {
    dapLogsSubject = new BehaviorSubject<LogEntry[]>(mockLogs);

    await TestBed.configureTestingModule({
      imports: [ProtocolConsoleComponent],
      providers: [
        { provide: DapLogService, useValue: { dapLogs$: dapLogsSubject.asObservable() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProtocolConsoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose dapLogs$ from service', async () => {
    // Verify the component correctly exposes the service stream
    const logs = await firstValueFrom(component.dapLogs$);
    expect(logs.length).toBe(2);
    expect(logs[0].message).toBe('[1] initialize');
    expect(logs[0].category).toBe('dap');
  });

  it('should start with all logs collapsed', () => {
    mockLogs.forEach(log => {
      expect(component.isLogExpanded(log)).toBe(false);
    });
  });

  it('should toggle expansion on click and back', () => {
    const log = mockLogs[0];

    // Expand
    component.toggleLogExpand(log);
    expect(component.isLogExpanded(log)).toBe(true);

    // Collapse
    component.toggleLogExpand(log);
    expect(component.isLogExpanded(log)).toBe(false);
  });

  it('should not expand a log with no data', () => {
    const noDataLog: LogEntry = { id: 99, timestamp: new Date(), message: 'No data', category: 'dap', level: 'info' };
    component.toggleLogExpand(noDataLog);
    expect(component.isLogExpanded(noDataLog)).toBe(false);
  });

  it('should expose a scrollToBottom method', () => {
    expect(typeof component.scrollToBottom).toBe('function');
  });

  it('should use unique ids for trackByLog', () => {
    const id1 = component.trackByLog(0, mockLogs[0]);
    const id2 = component.trackByLog(1, mockLogs[1]);
    expect(id1).not.toBe(id2);
    expect(id1).toBe('1');
    expect(id2).toBe('2');
  });
});
