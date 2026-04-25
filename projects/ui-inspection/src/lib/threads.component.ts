import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DapSessionService } from '@taro/dap-core';

/**
 * ThreadsComponent — Data binding via DapSessionService (WI-70)
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="threads-container">
      <ng-container *ngIf="dapSession.threads$ | async as threads">
        <div *ngIf="threads.length === 0" class="placeholder-content">No active threads</div>
        <ul *ngIf="threads.length > 0" class="thread-list">
          <li *ngFor="let thread of threads" 
              [class.active]="thread.id === (dapSession.activeThreadId$ | async)"
              (click)="onThreadClick(thread.id)">
            <span class="thread-id">[{{thread.id}}]</span> 
            <span class="thread-name">{{thread.name}}</span>
            <mat-icon *ngIf="thread.id === (dapSession.stoppedThreadId$ | async)" 
                      class="stopped-icon"
                      [matTooltip]="'Paused on ' + ((dapSession.stopReason$ | async) || 'breakpoint')">
              pause_circle
            </mat-icon>
          </li>
        </ul>
      </ng-container>
    </div>
  `,
  styles: [`
    .placeholder-content {
      padding: var(--sys-density-panel-padding);
      font-size: var(--text-sm);
      color: var(--mat-sys-on-surface-variant);
    }
    .thread-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .thread-list li {
      padding: 4px var(--sys-density-panel-padding);
      font-size: var(--text-sm);
      cursor: pointer;
      color: var(--mat-sys-on-surface);
      display: flex;
      align-items: center;
    }
    .thread-list li:hover {
      background-color: var(--mat-sys-surface-variant);
    }
    .thread-list li.active {
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-weight: bold;
    }
    .thread-id {
      color: var(--mat-sys-primary);
      margin-right: 8px;
      font-family: monospace;
    }
    .thread-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stopped-icon {
      margin-left: auto;
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--mat-sys-error);
      opacity: 0.85;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreadsComponent {
  public readonly dapSession = inject(DapSessionService);

  onThreadClick(threadId: number): void {
    this.dapSession.setCurrentThread(threadId);
  }
}

