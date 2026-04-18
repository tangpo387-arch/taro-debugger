import { InjectionToken } from '@angular/core';

export interface ElectronAPI {
  send: (channel: string, data: unknown) => void;
  on: (channel: string, func: (...args: unknown[]) => void) => () => void;
  invoke: (channel: string, data: unknown) => Promise<unknown>;
}

export const ELECTRON_API = new InjectionToken<ElectronAPI>('ELECTRON_API');
