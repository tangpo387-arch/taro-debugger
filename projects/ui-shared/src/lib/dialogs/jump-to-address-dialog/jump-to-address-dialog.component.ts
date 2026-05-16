import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface JumpToAddressData {
  title?: string;
  placeholder?: string;
  initialValue?: string;
  description?: string;
}

@Component({
  selector: 'taro-jump-to-address-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Jump to Address' }}</h2>
    <mat-dialog-content>
      <p>{{ data.description || 'Enter a target memory address, symbol, or reference.' }}</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ data.placeholder || 'Address / Reference' }}</mat-label>
        <input matInput [formControl]="addressControl" 
               [placeholder]="data.placeholder || 'e.g. 0x7fffffffdc00'" 
               (keyup.enter)="onJump()" 
               autofocus>
        <mat-error *ngIf="addressControl.hasError('required')">Address is required</mat-error>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="addressControl.invalid" (click)="onJump()">Jump</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-top: 8px;
    }
    mat-dialog-content {
      min-width: 300px;
    }
  `]
})
export class JumpToAddressDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<JumpToAddressDialogComponent>);
  public readonly data = inject<JumpToAddressData>(MAT_DIALOG_DATA, { optional: true }) || {};

  public addressControl = new FormControl(this.data.initialValue || '', [
    Validators.required
  ]);

  public onJump(): void {
    if (this.addressControl.valid && this.addressControl.value) {
      const value = this.addressControl.value.trim();
      this.dialogRef.close(value);
    }
  }

  public onCancel(): void {
    this.dialogRef.close();
  }
}
