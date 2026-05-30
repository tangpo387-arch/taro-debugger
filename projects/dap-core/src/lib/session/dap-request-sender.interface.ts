import { DapResponse } from '../dap.types';
import { ExecutionState } from './dap-session.service';

/**
 * Narrow interface for dispatching Debug Adapter Protocol (DAP) requests.
 * Used to decouple classes like DapThreadSession from the heavy DapSessionService class.
 */
export interface DapRequestSender {
  /**
   * The current execution state of the debug session.
   */
  readonly executionState: ExecutionState;

  /**
   * Dispatches a DAP request to the debug adapter.
   *
   * @param command The DAP command name.
   * @param args Optional arguments for the command.
   * @returns A promise resolving to the DAP response.
   */
  sendRequest(command: string, args?: any): Promise<DapResponse>;
}
