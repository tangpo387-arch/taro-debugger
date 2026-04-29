import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  ChangeDetectorRef,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import { LogEntry, DapSessionService, ExecutionState, EvaluateCancelledError } from '@taro/dap-core';
import { DapLogService } from '../dap-log.service';

/**
 * DebugConsoleComponent
 * 
 * Handles expression evaluation and displays system/DAP logs.
 */
@Component({
  selector: 'taro-debug-console',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ScrollingModule,
],
  templateUrl: './debug-console.html',
  styleUrls: ['./debug-console.scss'],
})
export class DebugConsoleComponent implements OnInit, OnDestroy {
  private readonly logService = inject(DapLogService);
  private readonly dapSession = inject(DapSessionService);
  private readonly cdr = inject(ChangeDetectorRef);

  public readonly consoleLogs$: Observable<LogEntry[]> = this.logService.consoleLogs$;

  private readonly expandedLogs = new Set<number>();
  public evaluateExpression: string = '';
  public executionState: ExecutionState = 'idle';
  public readonly evaluateInFlight$ = new BehaviorSubject<boolean>(false);
  public pendingEvaluateSeq?: number;

  @ViewChild(CdkVirtualScrollViewport)
  private viewport?: CdkVirtualScrollViewport;

  @ViewChild('consoleInput')
  private consoleInputRef?: ElementRef<HTMLInputElement>;

  private stateSubscription?: Subscription;
  private logSubscription?: Subscription;
  private trafficSubscription?: Subscription;

  get isEvaluateSupported(): boolean {
    return !!this.dapSession.capabilities?.supportsCancelRequest;
  }

  public ngOnInit(): void {
    // Mirror execution state for button gating
    this.stateSubscription = this.dapSession.executionState$.subscribe(state => {
      this.executionState = state;
      this.cdr.detectChanges();
    });

    // Auto-scroll
    this.logSubscription = this.consoleLogs$
      .pipe(auditTime(50))
      .subscribe(() => this.scrollToBottom());

    // Track evaluate request sequence for cancellation
    this.trafficSubscription = this.dapSession.onTraffic$.subscribe(msg => {
      if (this.evaluateInFlight$.value && msg.type === 'request' && msg.command === 'evaluate') {
        this.pendingEvaluateSeq = msg.seq;
      }
    });
  }

  public ngOnDestroy(): void {
    this.stateSubscription?.unsubscribe();
    this.logSubscription?.unsubscribe();
    this.trafficSubscription?.unsubscribe();
    this.expandedLogs.clear();
  }

  public trackByLog(_index: number, item: LogEntry): string {
    return item.id.toString();
  }

  public isLogExpanded(log: LogEntry): boolean {
    return this.expandedLogs.has(log.id);
  }

  public toggleLogExpand(log: LogEntry): void {
    if (!log.data) return;
    if (this.expandedLogs.has(log.id)) {
      this.expandedLogs.delete(log.id);
    } else {
      this.expandedLogs.add(log.id);
    }
    this.cdr.detectChanges();
  }

  public async evaluateCommand(): Promise<void> {
    if (this.evaluateInFlight$.value || !this.evaluateExpression.trim() || this.executionState !== 'stopped' || !this.isEvaluateSupported) {
      return;
    }

    const expr = this.evaluateExpression;
    this.evaluateInFlight$.next(true);
    this.logService.consoleLog(`> ${expr}`, 'info', 'system');

    try {
      const response = await this.dapSession.evaluate(expr);
      if (response.body?.result) {
        this.logService.consoleLog(response.body.result, 'info', 'stdout');
      }
    } catch (e: any) {
      if (e instanceof EvaluateCancelledError) {
        if (e.source === 'timeout') {
          this.logService.consoleLog('Evaluate timed out. The debugger may be unresponsive.', 'error', 'system');
        } else {
          this.logService.consoleLog('Evaluate cancelled.', 'info', 'system');
        }
      } else {
        this.logService.consoleLog(e.message || 'Evaluate failed.', 'error', 'system');
      }
    } finally {
      this.evaluateExpression = '';
      this.evaluateInFlight$.next(false);
      this.pendingEvaluateSeq = undefined;
      this.cdr.detectChanges();
    }
  }

  public onCancelEvaluate(): void {
    if (this.pendingEvaluateSeq !== undefined) {
      this.dapSession.cancelRequest(this.pendingEvaluateSeq);
      this.pendingEvaluateSeq = undefined;
    }
    this.evaluateInFlight$.next(false);
    this.cdr.detectChanges();
  }

  public scrollToBottom(): void {
    setTimeout(() => {
      if (this.viewport) {
        this.viewport.checkViewportSize();
        const count = this.viewport.getDataLength();
        if (count > 0) {
          this.viewport.scrollToIndex(count - 1);
        }
      }
    }, 50);
  }

  /**
   * Focuses the evaluation input field.
   */
  public focusInput(): void {
    if (this.consoleInputRef) {
      this.consoleInputRef.nativeElement.focus();
    }
  }
}
