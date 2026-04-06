import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChildren,
  QueryList,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

import { Observable, Subscription, merge } from 'rxjs';
import { auditTime } from 'rxjs/operators';

import { DapLogService } from './dap-log.service';
import { DapSessionService, ExecutionState } from './dap-session.service';
import { LogEntry } from './dap.types';

// ── Component ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    ScrollingModule,
  ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss'],
})
export class LogViewerComponent implements OnInit, OnDestroy {
  // ── Injected Services ────────────────────────────────────────────────────
  // R_SM4: inject directly — no @Input() from parent (DebuggerComponent)
  private readonly logService = inject(DapLogService);
  private readonly dapSession = inject(DapSessionService);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── Observables (SSOT from DapLogService) ───────────────────────────────
  public readonly consoleLogs$: Observable<LogEntry[]> = this.logService.consoleLogs$;
  public readonly programLogs$: Observable<LogEntry[]> = this.logService.programLogs$;

  // ── Local UI State ───────────────────────────────────────────────────────

  /** Tracks which log entries are expanded, keyed by timestamp string. */
  private readonly expandedLogs = new Set<string>();

  /** Current text in the evaluate command input. */
  public evaluateExpression: string = '';

  /** Local mirror of execution state to gate the evaluate button. */
  public executionState: ExecutionState = 'idle';

  /** Guard flag to prevent concurrent evaluate requests. */
  public isEvaluating: boolean = false;

  // ── Private State ────────────────────────────────────────────────────────

  private stateSubscription?: Subscription;
  private logSubscription?: Subscription;

  /** References to all virtual scroll viewports for auto-scrolling. */
  @ViewChildren(CdkVirtualScrollViewport)
  private viewports!: QueryList<CdkVirtualScrollViewport>;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  public ngOnInit(): void {
    // Mirror execution state for evaluate button gating (R_SM3: use async pipe where possible;
    // here we need a local boolean for the [disabled] binding without an async pipe chain)
    this.stateSubscription = this.dapSession.executionState$.subscribe(state => {
      this.executionState = state;
      this.cdr.detectChanges();
    });

    // Auto-scroll to bottom whenever either log stream emits.
    // auditTime(50) prevents scroll thrashing during high-frequency DAP traffic bursts.
    this.logSubscription = merge(this.consoleLogs$, this.programLogs$)
      .pipe(auditTime(50))
      .subscribe(() => this.scrollToBottom());
  }

  public ngOnDestroy(): void {
    this.stateSubscription?.unsubscribe();
    this.logSubscription?.unsubscribe();
    // R_SM5: clear UI-only state to release orphan timestamp keys
    this.expandedLogs.clear();
  }

  // ── Public Template Methods ──────────────────────────────────────────────

  /** TrackBy function for *cdkVirtualFor performance. */
  public trackByLog(_index: number, item: LogEntry): string {
    // Use ':' separator to avoid implicit number+string coercion ambiguity
    return `${item.timestamp.getTime()}:${item.message}`;
  }

  /** Returns true if the given log entry's payload is currently expanded. */
  public isLogExpanded(log: LogEntry): boolean {
    return this.expandedLogs.has(log.timestamp.getTime().toString());
  }

  /** Toggle the expanded/collapsed state of a log entry's structured payload. */
  public toggleLogExpand(log: LogEntry): void {
    if (!log.data) return;
    const key = log.timestamp.getTime().toString();
    if (this.expandedLogs.has(key)) {
      this.expandedLogs.delete(key);
    } else {
      this.expandedLogs.add(key);
    }
    this.cdr.detectChanges();
  }

  /** Send an evaluate DAP request and log the result to the console. */
  public async evaluateCommand(): Promise<void> {
    if (this.isEvaluating || !this.evaluateExpression.trim() || this.executionState !== 'stopped') {
      return;
    }

    const expr = this.evaluateExpression;
    this.evaluateExpression = '';
    this.isEvaluating = true;
    this.logService.consoleLog(`> ${expr}`, 'info', 'system');

    try {
      const response = await this.dapSession.sendRequest('evaluate', {
        expression: expr,
        context: 'repl',
      });

      if (response.body?.result) {
        this.logService.consoleLog(response.body.result, 'info', 'stdout');
      }
    } catch (e: any) {
      // Handled globally by synthetic DAP events
    } finally {
      this.isEvaluating = false;
      this.cdr.detectChanges();
    }
  }

  // ── Public Template Methods (Tab) ───────────────────────────────────────

  /**
   * Called when the user switches between Console and Program Console tabs.
   * CdkVirtualScrollViewport cannot calculate its size while hidden inside a
   * mat-tab (mat-tab uses visibility:hidden, not ngIf). checkViewportSize()
   * forces CDK to remeasure before scrolling to the correct position.
   */
  public onTabChange(): void {
    setTimeout(() => {
      this.viewports?.forEach(viewport => {
        viewport.checkViewportSize();
        const count = viewport.getDataLength();
        if (count > 0) {
          viewport.scrollToIndex(count - 1);
        }
      });
    }, 50);
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Scrolls all virtual scroll viewports to the last item.
   * checkViewportSize() is required because the viewport may have been
   * hidden (inactive tab) when earlier scroll attempts were made.
   * 'smooth' is intentionally omitted — rapid successive smooth-scroll
   * requests fight each other and leave the viewport in an intermediate
   * state. Instant jump is the correct behavior for a log console.
   */
  private scrollToBottom(): void {
    // Use requestAnimationFrame or setTimeout to ensure DOM is ready
    setTimeout(() => {
      this.viewports?.forEach(viewport => {
        viewport.checkViewportSize();
        const count = viewport.getDataLength();
        if (count > 0) {
          viewport.scrollToIndex(count - 1);
        }
      });
    }, 50);
  }
}
