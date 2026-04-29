import {
  Component,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { DebugConsoleComponent } from '../debug-console/debug-console';
import { OutputConsoleComponent } from '../output-console/output-console';
import { ProtocolConsoleComponent } from '../protocol-console/protocol-console';

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
    ProtocolConsoleComponent,
  ],
  templateUrl: './log-viewer.html',
  styleUrls: ['./log-viewer.scss'],
})
export class LogViewerComponent {
  public selectedTabIndex = 0;

  @ViewChildren(DebugConsoleComponent) 
  private debugConsoles!: QueryList<DebugConsoleComponent>;
  
  @ViewChildren(OutputConsoleComponent)
  private outputConsoles!: QueryList<OutputConsoleComponent>;

  @ViewChildren(ProtocolConsoleComponent)
  private protocolConsoles!: QueryList<ProtocolConsoleComponent>;

  /**
   * Called when the user switches between tabs.
   * Forces child viewports to remeasure and scroll to bottom.
   */
  public onTabChange(): void {
    // Both sub-components implement scrollToBottom() with a short timeout
    // to handle viewport visibility changes.
    this.debugConsoles?.forEach(c => c.scrollToBottom());
    this.outputConsoles?.forEach(c => c.scrollToBottom());
    this.protocolConsoles?.forEach(c => c.scrollToBottom());
  }

  /**
   * Focuses the input field of the Debug Console.
   * Switches to the Debug Console tab if not already active.
   */
  public focusDebugConsole(): void {
    this.selectedTabIndex = 0;
    setTimeout(() => {
      this.debugConsoles?.forEach(c => c.focusInput());
    }, 50);
  }
}
