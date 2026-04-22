import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * BreakpointsComponent — placeholder for the Breakpoints panel in ui-inspection.
 * Data binding (centralized breakpoints Map via DapSessionService) will be implemented in WI-71.
 */
@Component({
  selector: 'app-breakpoints',
  standalone: true,
  imports: [],
  template: `<div class="placeholder-content">No breakpoints set</div>`,
  styles: [`
    .placeholder-content {
      padding: var(--sys-density-panel-padding);
      font-size: var(--text-sm);
      color: var(--mat-sys-on-surface-variant);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreakpointsComponent {}
