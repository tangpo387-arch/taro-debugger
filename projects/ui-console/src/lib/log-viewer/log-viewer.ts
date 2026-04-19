import {
  Component,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { DebugConsoleComponent } from '../debug-console/debug-console';
import { OutputConsoleComponent } from '../output-console/output-console';

/**
 * LogViewerComponent
 * 
 * Orchestrator component that manages the different console tabs.
 */
@Component({
  selector: 'taro-log-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    DebugConsoleComponent,
    OutputConsoleComponent,
  ],
  templateUrl: './log-viewer.html',
  styleUrls: ['./log-viewer.scss'],
})
export class LogViewerComponent {
  @ViewChildren(DebugConsoleComponent) 
  private debugConsoles!: QueryList<DebugConsoleComponent>;
  
  @ViewChildren(OutputConsoleComponent)
  private outputConsoles!: QueryList<OutputConsoleComponent>;

  /**
   * Called when the user switches between tabs.
   * Forces child viewports to remeasure and scroll to bottom.
   */
  public onTabChange(): void {
    // Both sub-components implement scrollToBottom() with a short timeout
    // to handle viewport visibility changes.
    this.debugConsoles?.forEach(c => c.scrollToBottom());
    this.outputConsoles?.forEach(c => c.scrollToBottom());
  }
}
