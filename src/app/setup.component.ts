import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Import Angular Material modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';

// Import global configuration services
import { DapConfigService } from './dap-config.service';

/**
 * Custom validator: Validate DAP Server address format (host:port)
 * Example allowed formats: localhost:4711, 192.168.1.1:1234, my-server.local:9090
 */
function serverAddressValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string)?.trim();
  if (!value) return null; // Let the required validator handle empty values
  // host can contain letters, numbers, hyphens, dots; port is 1-5 digits
  const pattern = /^[a-zA-Z0-9._-]+:\d{1,5}$/;
  return pattern.test(value) ? null : { invalidFormat: true };
}

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatDividerModule,
  ],
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class SetupComponent implements OnInit, OnDestroy {

  /**
   * Main form group, using Reactive Forms to manage all field states and validation.
   * nonNullable: true ensures that getRawValue() returns a type that does not contain null.
   */
  readonly form = new FormGroup({
    serverAddress: new FormControl('localhost:4711', {
      nonNullable: true,
      validators: [Validators.required, serverAddressValidator]
    }),
    launchMode: new FormControl<'launch' | 'attach'>('launch', {
      nonNullable: true,
      validators: Validators.required
    }),
    executablePath: new FormControl('', {
      nonNullable: true,
      validators: Validators.required
    }),
    sourcePath: new FormControl('', { nonNullable: true }),
    programArgs: new FormControl('', { nonNullable: true })
  });

  private readonly router = inject(Router);
  private readonly configService = inject(DapConfigService);
  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    // Listen for launchMode changes and dynamically adjust executablePath's required validator
    this.subscriptions.add(
      this.form.controls.launchMode.valueChanges.subscribe(mode => {
        const execCtrl = this.form.controls.executablePath;
        if (mode === 'launch') {
          execCtrl.setValidators(Validators.required);
        } else {
          execCtrl.clearValidators();
          execCtrl.setValue(''); // Clear path when switching to Attach
        }
        execCtrl.updateValueAndValidity();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ── Convenience Getters: For Template usage ────────────────────────────

  /** Currently selected launch mode */
  get launchMode(): 'launch' | 'attach' {
    return this.form.controls.launchMode.value;
  }

  /** Return dynamic button label based on current launchMode */
  get connectButtonLabel(): string {
    return this.launchMode === 'launch' ? 'Launch & Debug' : 'Attach & Debug';
  }

  /** Return dynamic button icon based on current launchMode */
  get connectButtonIcon(): string {
    return this.launchMode === 'launch' ? 'play_arrow' : 'link';
  }

  // ── Event Handlers ──────────────────────────────────────────────────

  /**
   * Handle connection button click event.
   * If validation fails, mark all controls as touched to trigger inline error messages.
   */
  public onConnect(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { serverAddress, launchMode, executablePath, sourcePath, programArgs } =
      this.form.getRawValue();

    // 1. Delegate configuration parameters to DapConfigService for global caching
    this.configService.setConfig({
      serverAddress,
      transportType: 'websocket', // TODO: Allow selection via UI in the future
      launchMode,
      executablePath,
      sourcePath,
      programArgs
    });

    // 2. (Expansion placeholder) Call Electron IPC API to start underlying DAP process here
    // window.electronAPI.startDap(executablePath);

    // 3. Navigate to debug main view via Angular Router
    this.router.navigate(['/debug']);
  }
}