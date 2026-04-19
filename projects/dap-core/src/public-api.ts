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

// Re-export error types that might be needed by consumers
export { EvaluateCancelledError } from './lib/session/dap-session.service';
