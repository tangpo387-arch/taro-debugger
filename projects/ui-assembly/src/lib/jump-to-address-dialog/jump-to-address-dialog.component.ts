import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-jump-to-address-dialog',
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
  templateUrl: './jump-to-address-dialog.component.html',
  styleUrls: ['./jump-to-address-dialog.component.scss']
})
export class JumpToAddressDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<JumpToAddressDialogComponent>);

  public addressControl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^(0x)?[0-9a-fA-F]+$/)
  ]);

  public onJump(): void {
    if (this.addressControl.valid && this.addressControl.value) {
      const value = this.addressControl.value.trim().toLowerCase();
      const normalized = value.startsWith('0x') ? value : `0x${value}`;
      this.dialogRef.close(normalized);
    }
  }

  public onCancel(): void {
    this.dialogRef.close();
  }
}
