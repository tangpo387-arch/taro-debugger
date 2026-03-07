import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})

export class App {
  protected readonly title = signal('gdb-frontend');
  isGdbConnected:boolean = false;
  gdbStatusText:string = "No connected";

  onContinue() {
    console.log('繼續執行 (Continue)...');
    // 在這裡呼叫後端 GDB API 或偵錯服務
  }

  onStepOver() {
    console.log('單步執行 (Step Over)...');
  }

  onStop() {
    console.log('停止偵錯 (Stop)...');
  }
}
