import { Routes } from '@angular/router';

// Import the two page components we created
// [Note]: Adjust these paths based on your actual directory structure
import { SetupComponent } from './setup.component';
import { DebuggerComponent } from './debugger.component';

export const routes: Routes = [
  {
    // Load setup page when the URL is '/setup'
    path: 'setup',
    component: SetupComponent,
    title: 'Setup - Taro Debugger' // Sets the browser tab title
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
