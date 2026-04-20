import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Observable, Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import { LogEntry } from '@taro/dap-core';
import { DapLogService } from '../dap-log.service';

/**
 * ProtocolConsoleComponent
 *
 * Displays raw DAP protocol traffic with variable height expansion.
 * Uses a plain scrollable container (no virtual scroll) to guarantee
 * correct scroll bounds under all expand/collapse scenarios.
 */
@Component({
  selector: 'taro-protocol-console',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
  ],
  templateUrl: './protocol-console.html',
  styleUrls: ['./protocol-console.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolConsoleComponent implements OnInit, OnDestroy {
  private readonly logService = inject(DapLogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  public readonly dapLogs$: Observable<LogEntry[]> = this.logService.dapLogs$;

  private readonly expandedLogs = new Set<number>();

  @ViewChild('scrollContainer')
  private scrollContainer?: ElementRef<HTMLElement>;

  private logSubscription?: Subscription;

  public ngOnInit(): void {
    // Auto-scroll on new log entries
    this.logSubscription = this.dapLogs$
      .pipe(auditTime(16))
      .subscribe(() => this.scrollToBottom());
  }

  public ngOnDestroy(): void {
    this.logSubscription?.unsubscribe();
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

  /**
   * Scrolls the container to the absolute bottom.
   * With a plain div container, scrollTop = scrollHeight is always exact.
   */
  public scrollToBottom(): void {
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        const el = this.scrollContainer?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }
}
