import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { DapSessionService, VerifiedBreakpoint } from '@taro/dap-core';
import { TaroEmptyStateComponent } from '@taro/ui-shared';
import { map } from 'rxjs/operators';

interface GroupedBreakpoint {
  filePath: string;
  fileName: string;
  breakpoints: VerifiedBreakpoint[];
}

/**
 * BreakpointsComponent — displays a centralized list of breakpoints grouped by file.
 * Subscribes to DapSessionService.breakpoints$ for real-time synchronization.
 */
@Component({
  selector: 'app-breakpoints',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatButtonModule,
    TaroEmptyStateComponent
  ],
  templateUrl: './breakpoints.component.html',
  styleUrls: ['./breakpoints.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreakpointsComponent {
  private readonly dapSession = inject(DapSessionService);

  /** Emits when a user clicks a breakpoint to navigate to the source. */
  @Output() public readonly requestReveal = new EventEmitter<{ path: string, line: number }>();

  /**
   * Transforms the breakpoints Map into a sorted array of file groups for the template.
   * Files with no breakpoints are excluded; breakpoints within each file are sorted by line number.
   */
  public readonly groupedBreakpoints$ = this.dapSession.breakpoints$.pipe(
    map((bpMap: Map<string, VerifiedBreakpoint[]>) => {
      const groups: GroupedBreakpoint[] = [];
      bpMap.forEach((bps: VerifiedBreakpoint[], path: string) => {
        if (bps.length > 0) {
          groups.push({
            filePath: path,
            fileName: path.split('/').pop() || path,
            breakpoints: [...bps].sort((a, b) => a.line - b.line)
          });
        }
      });
      return groups.sort((a, b) => a.fileName.localeCompare(b.fileName));
    })
  );

  public onBreakpointClick(path: string, line: number): void {
    this.requestReveal.emit({ path, line });
  }

  public toggleEnabled(event: MatCheckboxChange, path: string, line: number): void {
    this.dapSession.toggleBreakpointEnabled(path, line);
  }

  public removeBreakpoint(event: MouseEvent, path: string, line: number): void {
    event.stopPropagation();
    this.dapSession.removeBreakpoint(path, line);
  }
}
