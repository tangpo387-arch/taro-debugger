import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OutputConsoleComponent } from './output-console';
import { DapLogService } from '../dap-log.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';

describe('OutputConsoleComponent', () => {
  let component: OutputConsoleComponent;
  let fixture: ComponentFixture<OutputConsoleComponent>;

  beforeEach(async () => {
    const mockLogService = {
      programLogs$: of([])
    };

    await TestBed.configureTestingModule({
      imports: [OutputConsoleComponent],
      providers: [
        { provide: DapLogService, useValue: mockLogService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OutputConsoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
