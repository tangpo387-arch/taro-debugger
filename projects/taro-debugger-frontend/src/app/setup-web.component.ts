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
import { DapConfigService } from '@taro/dap-core';

import { serverAddressValidator } from './setup.validators';

@Component({
  selector: 'app-setup-web',
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
  templateUrl: './setup-web.component.html',
  styleUrls: ['./setup-web.component.scss']
})
export class SetupWebComponent implements OnInit, OnDestroy {

  /**
   * Main form group, using Reactive Forms to manage all field states and validation.
   */
  readonly form = new FormGroup({
    serverAddress: new FormControl('', {
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
    // 1. Initial configuration load: restore last used settings if available
    const existingConfig = this.configService.getConfig();
    this.form.patchValue({
      serverAddress: existingConfig.serverAddress,
      launchMode: existingConfig.launchMode,
      executablePath: existingConfig.executablePath,
      sourcePath: existingConfig.sourcePath,
      programArgs: existingConfig.programArgs
    });

    // 2. Adjust initial validation based on loaded launchMode
    this.updateExecPathValidator(existingConfig.launchMode);

    // 3. Listen for launchMode changes and dynamically adjust executablePath's required validator
    this.subscriptions.add(
      this.form.controls.launchMode.valueChanges.subscribe(mode => {
        this.updateExecPathValidator(mode);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Centralized logic for updating executablePath validation rules */
  private updateExecPathValidator(mode: 'launch' | 'attach'): void {
    const execCtrl = this.form.controls.executablePath;
    if (mode === 'launch') {
      execCtrl.setValidators(Validators.required);
    } else {
      execCtrl.clearValidators();
      // UX Decision: Do NOT clear the path value here to prevent data loss if the user toggles back
    }
    execCtrl.updateValueAndValidity();
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

    // 1. Merge current configuration with form values to preserve non-UI state (like transportType)
    const currentConfig = this.configService.getConfig();
    this.configService.setConfig({
      ...currentConfig,
      ...this.form.getRawValue(),
      transportType: 'websocket'
    });

    // 2. Navigate to debug main view via Angular Router
    this.router.navigate(['/debug']);
  }
}