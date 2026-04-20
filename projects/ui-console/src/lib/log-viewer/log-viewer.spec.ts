import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogViewerComponent } from './log-viewer';
import { DapSessionService } from '@taro/dap-core';
import { DapLogService } from '../dap-log.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, of } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('LogViewerComponent', () => {
  let component: LogViewerComponent;
  let fixture: ComponentFixture<LogViewerComponent>;

  beforeEach(async () => {
    const mockDapSession = {
      executionState$: of('idle'),
      onTraffic$: EMPTY,
      capabilities: {}
    };
    const mockLogService = {
      consoleLogs$: of([]),
      programLogs$: of([]),
      dapLogs$: of([])
    };
    const mockSnackBar = { open: () => {} };

    await TestBed.configureTestingModule({
      imports: [LogViewerComponent],
      providers: [
        { provide: DapSessionService, useValue: mockDapSession },
        { provide: DapLogService, useValue: mockLogService },
        { provide: MatSnackBar, useValue: mockSnackBar }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LogViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
