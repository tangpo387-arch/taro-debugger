import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { DapConfigService } from '@taro/dap-core';

@Component({
  selector: 'app-setup-electron',
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
  templateUrl: './setup-electron.component.html',
  styleUrls: ['./setup-electron.component.scss']
})
export class SetupElectronComponent implements OnInit, OnDestroy {
  readonly form = new FormGroup({
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
    /**
     * Path to the .tarodb session directory on the local filesystem.
     * Sent to taro-session via the setup channel before DAP initialization.
     */
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
    const existingConfig = this.configService.getConfig();
    this.form.patchValue({
      launchMode: existingConfig.launchMode,
      executablePath: existingConfig.executablePath,
      sourcePath: existingConfig.sourcePath,
      programArgs: existingConfig.programArgs,
      stopOnEntry: existingConfig.stopOnEntry,
      sessionPath: existingConfig.sessionPath || '.tarodb',
      setupMode: existingConfig.setupMode || 'new'
    });

    this.updateValidators();

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
    }
    execCtrl.updateValueAndValidity();
  }

  get setupMode(): 'new' | 'open' {
    return this.form.controls.setupMode.value;
  }

  get launchMode(): 'launch' | 'attach' {
    return this.form.controls.launchMode.value;
  }

  get connectButtonLabel(): string {
    if (this.setupMode === 'open') {
      return 'Open & Debug';
    }
    return this.launchMode === 'launch' ? 'Launch & Debug' : 'Attach & Debug';
  }

  get connectButtonIcon(): string {
    if (this.setupMode === 'open') {
      return 'folder_open';
    }
    return this.launchMode === 'launch' ? 'play_arrow' : 'link';
  }

  public onConnect(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const currentConfig = this.configService.getConfig();
    this.configService.setConfig({
      ...currentConfig,
      ...this.form.getRawValue(),
      // Explicitly clear web-only field
      serverAddress: '',
      transportType: 'ipc'
    });

    this.router.navigate(['/debug']);
  }
}
