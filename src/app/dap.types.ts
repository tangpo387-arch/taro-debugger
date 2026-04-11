export interface DapMessage {
  seq: number;
  type: 'request' | 'response' | 'event';
}

export interface DapRequest extends DapMessage {
  type: 'request';
  command: string;
  arguments?: any;
}

export interface DapResponse extends DapMessage {
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: any;
}

export interface DapEvent extends DapMessage {
  type: 'event';
  event: string;
  body?: any;
}

/** 
 * Log Categories used to classify output messages:
 * - 'console': Standard Debugger console messages.
 * - 'stdout': debuggee program standard output.
 * - 'stderr': debuggee program standard error.
 * - 'system': Internal debugger frontend/system messages (e.g., "Connecting...").
 * - 'dap': DAP protocol or telemetry events (e.g., "[Event] stopped").
 */
export type LogCategory = 'console' | 'stdout' | 'stderr' | 'system' | 'dap';

/** Log Entry structure */
export interface LogEntry {
  timestamp: Date;
  message: string;
  category: LogCategory;
  level: 'info' | 'error';
  /** Optional structured payload (e.g. a raw DAP event object) for UI inspection. */
  data?: any;
}

/** 
 * Strongly typed interface for a Debug Adapter Protocol Stack Frame 
 * Used for rendering the call stack UI.
 */
export interface DapStackFrame {
  id: number;
  name: string;
  source?: {
    name?: string;
    path?: string;
    [key: string]: any;
  };
  line: number;
  column: number;
  instructionPointerReference?: string;
  moduleId?: number | string;
  [key: string]: any;
}

