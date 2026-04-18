import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { WebSocketTransportService } from './transport/websocket-transport.service';
import { IpcTransportService } from './transport/ipc-transport.service';
import { TransportFactoryService } from './transport/transport-factory.service';
import { DapSessionService } from './session/dap-session.service';
import { DapConfigService } from './session/dap-config.service';

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
    // Note: ELECTRON_API token should be provided by the host application 
    // if IPC transport is used.
  ]);
}
