import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { DapStackFrame } from './dap.types';

@Component({
  selector: 'app-call-stack',
  standalone: true,
  imports: [CommonModule, MatListModule],
  templateUrl: './call-stack.component.html',
  styleUrls: ['./call-stack.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CallStackComponent {
  /** The list of stack frames provided by the DAP session */
  @Input() public stackFrames: DapStackFrame[] = [];
  
  /** The ID of the currently selected stack frame */
  @Input() public activeFrameId: number | null = null;
  
  /** Event emitted when a user selects a stack frame */
  @Output() public frameSelected = new EventEmitter<DapStackFrame>();

  /**
   * Internal click handler that bubbles up the frame selection
   */
  public onFrameClick(frame: DapStackFrame): void {
    this.frameSelected.emit(frame);
  }
}
