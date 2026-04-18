import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { WebSocketTransportService } from './transport/websocket-transport.service';
import { IpcTransportService } from './transport/ipc-transport.service';
import { TransportFactoryService } from './transport/transport-factory.service';

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
    // Note: ELECTRON_API token should be provided by the host application 
    // if IPC transport is used.
  ]);
}
