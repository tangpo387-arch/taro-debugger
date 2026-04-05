import { Routes } from '@angular/router';

// Import the two page components we created
import { electronRedirectGuard } from './electron-redirect.guard';
import { SetupWebComponent } from './setup-web.component';
import { SetupElectronComponent } from './setup-electron.component';
import { DebuggerComponent } from './debugger.component';

export const routes: Routes = [
  {
    // Redirect gateway for setup
    path: 'setup',
    canActivate: [electronRedirectGuard],
    children: [] // No component is rendered here
  },
  {
    path: 'setup-web',
    component: SetupWebComponent,
    title: 'Setup - Taro Debugger (Web)'
  },
  {
    path: 'setup-electron',
    component: SetupElectronComponent,
    title: 'Setup - Taro Debugger (Desktop)'
  },
  {
    // Load the core debugger view when the URL is '/debug'
    path: 'debug',
    component: DebuggerComponent,
    title: 'Debugger - Taro Debugger'
  },
  {
    // Automatically redirect to the setup page when the URL is empty (root)
    path: '',
    redirectTo: '/setup',
    pathMatch: 'full' // Ensure redirect only triggers on exact empty path
  },
  {
    // Catch-all route:
    // Automatically redirect back to the setup page if the URL doesn't exist
    path: '**',
    redirectTo: '/setup'
  }
];
