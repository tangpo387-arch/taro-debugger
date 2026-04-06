import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EnvironmentDetectService } from './environment-detect.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private envDetect = inject(EnvironmentDetectService);

  ngOnInit() {
    if (this.envDetect.isElectron()) {
      document.body.classList.add('ui-density-desktop');
    } else {
      document.body.classList.add('ui-density-panel');
    }
  }
}
