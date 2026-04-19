import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Observable, Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import { LogEntry } from '@taro/dap-core';
import { DapLogService } from '../dap-log.service';

/**
 * OutputConsoleComponent
 * 
 * Displays the program output stream (stdout/stderr).
 */
@Component({
  selector: 'taro-output-console',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  templateUrl: './output-console.html',
  styleUrls: ['./output-console.scss'],
})
export class OutputConsoleComponent implements OnInit, OnDestroy {
  private readonly logService = inject(DapLogService);

  public readonly programLogs$: Observable<LogEntry[]> = this.logService.programLogs$;

  @ViewChild(CdkVirtualScrollViewport)
  private viewport?: CdkVirtualScrollViewport;

  private logSubscription?: Subscription;

  public ngOnInit(): void {
    // Auto-scroll to bottom whenever the log stream emits.
    this.logSubscription = this.programLogs$
      .pipe(auditTime(50))
      .subscribe(() => this.scrollToBottom());
  }

  public ngOnDestroy(): void {
    this.logSubscription?.unsubscribe();
  }

  public trackByLog(_index: number, item: LogEntry): string {
    return item.id.toString();
  }

  /**
   * Forces a scroll to the bottom of the viewport.
   * Public so it can be triggered by the parent orchestrator on tab change.
   */
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
}
