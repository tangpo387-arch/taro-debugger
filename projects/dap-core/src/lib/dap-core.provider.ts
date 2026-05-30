import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { WebSocketTransportService } from './transport/websocket-transport.service';
import { IpcTransportService } from './transport/ipc-transport.service';
import { TransportFactoryService } from './transport/transport-factory.service';
import { DapSessionService } from './session/dap-session.service';
import { DapConfigService } from './session/dap-config.service';
import { DapAssemblyCacheService } from './session/dap-assembly-cache.service';
import { DapMemoryService } from './session/dap-memory.service';
import { DapBreakpointManager } from './session/dap-breakpoint-manager.service';
import { DapThreadManager } from './session/dap-thread-manager.service';

/**
 * Provides the core DAP library services.
 *
 * @returns EnvironmentProviders for the DAP core library.
 */
export function provideDapCore(): EnvironmentProviders {
  return makeEnvironmentProviders([
    TransportFactoryService,
    WebSocketTransportService,
    IpcTransportService,
    DapSessionService,
    DapConfigService,
    DapAssemblyCacheService,
    DapMemoryService,
    DapBreakpointManager,
    DapThreadManager,
    // Note: ELECTRON_API token should be provided by the host application
    // if IPC transport is used.
  ]);
}

