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
import { MatCheckboxModule } from '@angular/material/checkbox';

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
    MatCheckboxModule,
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
    programArgs: new FormControl('', { nonNullable: true }),
    stopOnEntry: new FormControl(true, { nonNullable: true }),
    sessionPath: new FormControl('.tarodb', {
      nonNullable: true,
      validators: Validators.required
    }),
    setupMode: new FormControl<'new' | 'open'>('new', {
      nonNullable: true,
      validators: Validators.required
    })
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
      programArgs: existingConfig.programArgs,
      stopOnEntry: existingConfig.stopOnEntry,
      sessionPath: existingConfig.sessionPath || '.tarodb',
      setupMode: existingConfig.setupMode || 'new'
    });

    // 2. Adjust initial validation based on loaded launchMode & setupMode
    this.updateValidators();

    // 3. Listen for launchMode & setupMode changes and dynamically adjust executablePath's required validator
    this.subscriptions.add(
      this.form.controls.launchMode.valueChanges.subscribe(() => {
        this.updateValidators();
      })
    );
    this.subscriptions.add(
      this.form.controls.setupMode.valueChanges.subscribe(() => {
        this.updateValidators();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Centralized logic for updating executablePath validation rules based on setupMode and launchMode */
  private updateValidators(): void {
    const setupMode = this.form.controls.setupMode.value;
    const launchMode = this.form.controls.launchMode.value;
    const execCtrl = this.form.controls.executablePath;

    if (setupMode === 'new' && launchMode === 'launch') {
      execCtrl.setValidators(Validators.required);
    } else {
      execCtrl.clearValidators();
      // UX Decision: Do NOT clear the path value here to prevent data loss if the user toggles back
    }
    execCtrl.updateValueAndValidity();
  }

  // ── Convenience Getters: For Template usage ────────────────────────────

  /** Currently selected setup mode */
  get setupMode(): 'new' | 'open' {
    return this.form.controls.setupMode.value;
  }

  /** Currently selected launch mode */
  get launchMode(): 'launch' | 'attach' {
    return this.form.controls.launchMode.value;
  }

  /** Return dynamic button label based on setupMode and launchMode */
  get connectButtonLabel(): string {
    if (this.setupMode === 'open') {
      return 'Open & Debug';
    }
    return this.launchMode === 'launch' ? 'Launch & Debug' : 'Attach & Debug';
  }

  /** Return dynamic button icon based on setupMode and launchMode */
  get connectButtonIcon(): string {
    if (this.setupMode === 'open') {
      return 'folder_open';
    }
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