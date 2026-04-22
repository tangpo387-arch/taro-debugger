import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * ThreadsComponent — placeholder for the Threads panel in ui-inspection.
 * Data binding via DapSessionService will be implemented in WI-70.
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [],
  template: `<div class="placeholder-content">No active threads</div>`,
  styles: [`
    .placeholder-content {
      padding: var(--sys-density-panel-padding);
      font-size: var(--text-sm);
      color: var(--mat-sys-on-surface-variant);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreadsComponent {}
