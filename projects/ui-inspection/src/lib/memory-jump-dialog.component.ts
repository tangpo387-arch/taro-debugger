import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-memory-jump-dialog',
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
    <h2 mat-dialog-title>Jump to Address</h2>
    <mat-dialog-content>
      <p>Enter a memory address or reference string to inspect.</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Address / Reference</mat-label>
        <input matInput [formControl]="addressControl" placeholder="e.g. 0x7fffffffdc00" (keyup.enter)="onJump()" autofocus>
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
export class MemoryJumpDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MemoryJumpDialogComponent>);

  public addressControl = new FormControl('', [
    Validators.required
  ]);

  public onJump(): void {
    if (this.addressControl.valid && this.addressControl.value) {
      this.dialogRef.close(this.addressControl.value.trim());
    }
  }

  public onCancel(): void {
    this.dialogRef.close();
  }
}
