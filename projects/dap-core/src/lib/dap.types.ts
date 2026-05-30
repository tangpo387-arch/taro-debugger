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

export interface DapThread {
  id: number;
  name: string;
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
  id: number;
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
    /** Non-zero when the source is virtual (not a physical file on disk). */
    sourceReference?: number;
    [key: string]: any;
  };
  line: number;
  column: number;
  instructionPointerReference?: bigint;
  moduleId?: number | string;
  [key: string]: any;
}

/**
 * Arguments for the 'disassemble' request.
 */
export interface DisassembleArguments {
  memoryReference: string;
  instructionOffset?: number;
  offset?: number;
  instructionCount: number;
  resolveSymbols?: boolean;
}

/**
 * Represents a single disassembled instruction.
 */
export interface DapDisassembledInstruction {
  address: bigint;
  instructionBytes: string;
  instructionByteLength: number;
  instruction: string;
  symbol?: string;
  location?: any;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  /** Normalized function name (brackets, offsets, and angle-brackets stripped). */
  normalizedSymbol?: string;
  /** Byte offset of this instruction from the start of its function. */
  byteOffset?: number;
  /** True if this instruction is the entry point of its function. */
  isFunctionStart?: boolean;
}

/**
 * Response to 'disassemble' request.
 */
export interface DapDisassemblyResponse extends DapResponse {
  body?: {
    instructions: DapDisassembledInstruction[];
  };
}

/**
 * Stepping granularity.
 * - 'statement': Stepping at the statement level.
 * - 'line': Stepping at the line level.
 * - 'instruction': Stepping at the instruction level (e.g., stepi/nexti).
 */
export type SteppingGranularity = 'statement' | 'line' | 'instruction';

/**
 * Arguments for 'next', 'stepIn', 'stepOut', and 'stepBack' requests.
 */
export interface StepArguments {
  threadId: number;
  singleThread?: boolean;
  granularity?: SteppingGranularity;
}

/** 
 * Transport Type:
 * - 'websocket': standard TCP connection to a debugger port.
 * - 'ipc': Electron IPC bridge to a Node.js-managed debugger session.
 * - 'serial': Serial port connection.
 * - 'tcp': Raw TCP socket connection.
 */
export type TransportType = 'websocket' | 'ipc' | 'serial' | 'tcp';

/**
 * Arguments for the 'readMemory' request.
 */
export interface ReadMemoryArguments {
  memoryReference: string;
  offset?: number;
  count: number;
}

/**
 * Response to the 'readMemory' request.
 */
export interface ReadMemoryResponse extends DapResponse {
  body?: {
    address: string;
    unreadableBytes?: number;
    data?: string; // Base64 encoded
  };
}

/**
 * Arguments for the 'writeMemory' request.
 */
export interface WriteMemoryArguments {
  memoryReference: string;
  offset?: number;
  allowPartial?: boolean;
  data: string; // Base64 encoded
}

/**
 * Response to the 'writeMemory' request.
 */
export interface WriteMemoryResponse extends DapResponse {
  body?: {
    offset?: number;
    bytesWritten?: number;
  };
}

/**
 * Capabilities reported by the debug adapter in the InitializeResponse.
 * Based on the DAP specification's Capabilities interface.
 */
export interface DapCapabilities {
  supportsConfigurationDoneRequest?: boolean;
  supportsFunctionBreakpoints?: boolean;
  supportsConditionalBreakpoints?: boolean;
  supportsHitConditionalBreakpoints?: boolean;
  supportsEvaluateForHovers?: boolean;
  supportsStepBack?: boolean;
  supportsSetVariable?: boolean;
  supportsRestartFrame?: boolean;
  supportsGotoTargetsRequest?: boolean;
  supportsStepInTargetsRequest?: boolean;
  supportsCompletionsRequest?: boolean;
  supportsModulesRequest?: boolean;
  supportsRestartRequest?: boolean;
  supportsExceptionOptions?: boolean;
  supportsValueFormattingOptions?: boolean;
  supportsExceptionInfoRequest?: boolean;
  supportTerminateDebuggee?: boolean;
  supportsTerminateRequest?: boolean;
  supportsSingleThreadExecutionRequests?: boolean;
  supportsCancelRequest?: boolean;
  supportsDisassembleRequest?: boolean;
  supportsReadMemoryRequest?: boolean;
  supportsWriteMemoryRequest?: boolean;
  supportsSteppingGranularity?: boolean;
  supportsInstructionBreakpoints?: boolean;
  supportsLoadedSourcesRequest?: boolean;
  supportsDataBreakpoints?: boolean;
  /** Additional capabilities not explicitly listed. */
  [key: string]: any;
}
