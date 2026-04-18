import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ErrorDialogData {
  title?: string;
  message: string;
}

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './error-dialog.html',
  styleUrl: './error-dialog.css',
})
export class ErrorDialog {
  constructor(
    public dialogRef: MatDialogRef<ErrorDialog>,
    @Inject(MAT_DIALOG_DATA) public data: ErrorDialogData
  ) {}

  onRetry(): void {
    this.dialogRef.close('retry');
  }

  onGoBack(): void {
    this.dialogRef.close('goback');
  }
}
