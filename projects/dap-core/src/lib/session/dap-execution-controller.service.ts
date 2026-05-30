import { Injectable, inject, Injector } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DapResponse, StepArguments } from '../dap.types';
import { DapThreadManager } from './dap-thread-manager.service';
import { ExecutionState, DapFatalException, DapSessionService } from './dap-session.service';
import { DapSessionLifecycle } from './dap-session-lifecycle.service';

/**
 * Service responsible for managing stepping, pausing, and continue commands
 * along with transition guard timing logic to prevent command collisions.
 */
@Injectable()
export class DapExecutionController {
  private readonly threadManager = inject(DapThreadManager);
  private readonly injector = inject(Injector);

  private readonly commandInFlightSubject = new BehaviorSubject<boolean>(false);
  public readonly commandInFlight$ = this.commandInFlightSubject.asObservable();

  private stateTransitionTimer?: any;
  private readonly STATE_TRANSITION_TIMEOUT_MS = 5000;

  public get commandInFlight(): boolean {
    return this.commandInFlightSubject.value;
  }

  public setCommandInFlight(inFlight: boolean): void {
    this.commandInFlightSubject.next(inFlight);
  }

  private get lifecycle(): DapSessionLifecycle {
    return this.injector.get(DapSessionLifecycle);
  }

  private get sessionService(): DapSessionService {
    return this.injector.get(DapSessionService);
  }

  private assertState(allowedStates: ExecutionState[], actionName: string): void {
    const currentState = this.lifecycle.executionState;
    if (!allowedStates.includes(currentState)) {
      throw new DapFatalException(
        `Cannot perform '${actionName}' from execution state '${currentState}'. Allowed states: ${allowedStates.join(', ')}`
      );
    }
  }

  private async executeStepCommand(
    command: string,
    allThreadsContinued: boolean,
    extraArgs?: Partial<StepArguments>,
    allowedStates: ExecutionState[] = ['stopped']
  ): Promise<DapResponse> {
    this.assertState(allowedStates, command);
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command, success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    this.startStateTransitionGuard(command);
    try {
      const threadId = this.threadManager.activeThread?.id || 1;
      const args: StepArguments = { threadId, ...extraArgs };
      const response = await this.sessionService.sendRequest(command, args);
      if (response.success) {
        this.threadManager.handleResumptionState(
          command === 'continue' ? (response.body?.allThreadsContinued ?? true) : allThreadsContinued,
          threadId
        );
      } else {
        this.clearStateTransitionGuard();
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.clearStateTransitionGuard();
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  public async continue(): Promise<DapResponse> {
    return this.executeStepCommand('continue', true);
  }

  public async next(): Promise<DapResponse> {
    return this.executeStepCommand('next', false);
  }

  public async stepIn(): Promise<DapResponse> {
    return this.executeStepCommand('stepIn', false);
  }

  public async stepOut(): Promise<DapResponse> {
    return this.executeStepCommand('stepOut', false);
  }

  public async nextInstruction(): Promise<DapResponse> {
    return this.executeStepCommand('next', false, { granularity: 'instruction' });
  }

  public async stepInInstruction(): Promise<DapResponse> {
    return this.executeStepCommand('stepIn', false, { granularity: 'instruction' });
  }

  public async pause(): Promise<DapResponse> {
    if (this.commandInFlightSubject.value) {
      return Promise.resolve({ seq: 0, type: 'response', command: 'pause', success: true, request_seq: 0 });
    }
    this.commandInFlightSubject.next(true);
    try {
      const threadId = this.threadManager.activeThread?.id || 1;
      const response = await this.sessionService.sendRequest('pause', { threadId });
      if (!response.success) {
        this.commandInFlightSubject.next(false);
      }
      return response;
    } catch (e) {
      this.commandInFlightSubject.next(false);
      throw e;
    }
  }

  public startStateTransitionGuard(command: string): void {
    this.clearStateTransitionGuard();
    this.stateTransitionTimer = setTimeout(() => {
      if (this.commandInFlightSubject.value) {
        this.commandInFlightSubject.next(false);
        this.lifecycle.emitSyntheticEvent({
          seq: 0,
          type: 'event',
          event: '_sessionError',
          body: {
            message: `'${command}': adapter did not emit a state transition within ${this.STATE_TRANSITION_TIMEOUT_MS}ms. UI unlocked.`
          }
        });
      }
    }, this.STATE_TRANSITION_TIMEOUT_MS);
  }

  public clearStateTransitionGuard(): void {
    if (this.stateTransitionTimer) {
      clearTimeout(this.stateTransitionTimer);
      this.stateTransitionTimer = undefined;
    }
  }
}
