import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  /**
   * Core entry point of the application.
   * State management and UI logic are handled by individual components and services,
   * so this entry point remains simple.
   */
}
