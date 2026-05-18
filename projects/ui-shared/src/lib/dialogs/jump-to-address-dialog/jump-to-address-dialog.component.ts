import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';

export interface JumpToAddressData {
  title?: string;
  placeholder?: string;
  initialValue?: string;
  description?: string;
}

/**
 * Custom validator for memory addresses.
 * Validates that the input is a valid decimal string or a hexadecimal string strictly starting with a 0x/0X prefix.
 */
export function addressValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const trimmed = String(value).trim();
    if (trimmed === '') {
      return { invalidAddress: true };
    }
    // Matches hexadecimal format (strictly starting with 0x/0X prefix followed by hex digits) or decimal format.
    const isValid = /^(0[xX][0-9a-fA-F]+|\d+)$/.test(trimmed);
    return isValid ? null : { invalidAddress: true };
  };
}

/**
 * Custom error state matcher that shows errors immediately when the control is dirty,
 * rather than waiting for the control to be touched or the form to be submitted.
 */
export class InstantErrorStateMatcher implements ErrorStateMatcher {
  public isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
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
  templateUrl: './jump-to-address-dialog.component.html',
  styleUrls: ['./jump-to-address-dialog.component.scss']
})
export class JumpToAddressDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<JumpToAddressDialogComponent, bigint>);
  public readonly data = inject<JumpToAddressData>(MAT_DIALOG_DATA, { optional: true }) || {};

  public readonly errorMatcher: InstantErrorStateMatcher = new InstantErrorStateMatcher();

  public addressControl: FormControl<string | null> = new FormControl(this.data.initialValue || '', [
    Validators.required,
    addressValidator()
  ]);

  public onJump(): void {
    if (this.addressControl.valid && this.addressControl.value) {
      const value = this.addressControl.value.trim();
      this.dialogRef.close(BigInt(value));
    }
  }

  public onCancel(): void {
    this.dialogRef.close();
  }
}
