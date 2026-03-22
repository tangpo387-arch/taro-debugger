import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <!--
      The root router container for the application.
      Based on the current URL, the following will be dynamically mounted here:
      1. SetupComponent (Path: /setup)
      2. DebuggerComponent (Path: /debug)
    -->
    <router-outlet></router-outlet>
  `,
  styles: [`
    /* Ensure the root component fills the entire window space as the base canvas */
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: #f9fafb; /* Default light background, adjustable as needed */
    }
  `]
})
export class App {
  /**
   * Core entry point of the application.
   * State management and UI logic are handled by individual components and services,
   * so this entry point remains simple.
   */
}
