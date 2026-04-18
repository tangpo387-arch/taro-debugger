import { Component, inject, HostBinding } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EnvironmentDetectService } from './environment-detect.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  @HostBinding('class.electron-env')
  public readonly isElectron = inject(EnvironmentDetectService).isElectron();
}
