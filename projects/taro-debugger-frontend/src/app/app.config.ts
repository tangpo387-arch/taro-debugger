import { ApplicationConfig, provideBrowserGlobalErrorListeners, importProvidersFrom  } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { provideDapCore, ELECTRON_API } from '@taro/dap-core';
import { GlobalFatalErrorHandler } from './fatal-error-handler';
import { ErrorHandler } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalFatalErrorHandler },
    provideRouter(routes, withHashLocation()),
    provideHttpClient(),
    provideDapCore(),
    {
      provide: ELECTRON_API,
      useFactory: () => (window as any).electronAPI
    },
    importProvidersFrom(MonacoEditorModule.forRoot({
        baseUrl: 'assets/monaco'
    }))
  ]
};

