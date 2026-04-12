import { Component, inject, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DapSessionService } from './dap-session.service';
import { map } from 'rxjs';

/**
 * DebugControlGroupComponent
 *
 * Implements the "Floating Debug Toolbar" design as specified by the Product Architect.
 * Provides logical grouping of DAP execution controls (Continue, Step, Restart, Stop).
 * Uses M3 Color tokens with an 8px border-radius exception for high-priority overlay aesthetics.
 */
@Component({
  selector: 'app-debug-control-group',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './debug-control-group.component.html',
  styleUrls: ['./debug-control-group.component.scss']
})
export class DebugControlGroupComponent {
  @Output() public readonly restart = new EventEmitter<void>();
  @Output() public readonly stop = new EventEmitter<void>();
  @Output() public readonly stepInstructionTab = new EventEmitter<'stepi' | 'nexti'>();

  /** 
   * Active tab index of the content area.
   * 0: Source View
   * 1: Disassembly View
   */
  @Input() public activeTabIndex = 0;

  private readonly dapSession = inject(DapSessionService);

  /** Observable for the execution state to drive button disabling logic */
  public readonly executionState$ = this.dapSession.executionState$;

  /** Convenience observables for specific button states */
  public readonly isStopped$ = this.executionState$.pipe(map(state => state === 'stopped'));
  public readonly isRunning$ = this.executionState$.pipe(map(state => state === 'running'));
  public readonly isStarting$ = this.executionState$.pipe(map(state => state === 'starting' || state === 'idle'));
  public readonly isError$ = this.executionState$.pipe(map(state => state === 'error'));

  // ── Execution Handlers ───────────────────────────────────────────────────

  public onResume(): void {
    this.dapSession.continue().catch(() => {});
  }

  public onPause(): void {
    this.dapSession.pause().catch(() => {});
  }

  public onStepOver(): void {
    this.dapSession.next().catch(() => {});
  }

  public onStepInto(): void {
    this.dapSession.stepIn().catch(() => {});
  }

  public onStepOut(): void {
    this.dapSession.stepOut().catch(() => {});
  }

  public onRestart(): void {
    this.restart.emit();
  }

  public onStop(): void {
    this.stop.emit();
  }

  public onStepNextInstruction(): void {
    this.stepInstructionTab.emit('nexti');
  }

  public onStepIntoInstruction(): void {
    this.stepInstructionTab.emit('stepi');
  }
}
