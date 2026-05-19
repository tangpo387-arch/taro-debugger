/*
 * Public API Surface of @taro/dap-core
 */

export * from './lib/dap.types';
export * from './lib/dap-core.provider';
export * from './lib/transport/dap-transport.service';
export * from './lib/transport/websocket-transport.service';
export * from './lib/transport/ipc-transport.service';
export * from './lib/transport/transport-factory.service';
export * from './lib/transport/electron-api.token';
export * from './lib/session/dap-session.service';
export * from './lib/session/dap-config.service';
export * from './lib/session/assembly.types';
export * from './lib/session/dap-assembly-cache.service';
export * from './lib/session/dap-memory.service';
export * from './lib/session/dap-thread';

// Re-export error types that might be needed by consumers
export { EvaluateCancelledError, DapFatalException } from './lib/session/dap-session.service';
