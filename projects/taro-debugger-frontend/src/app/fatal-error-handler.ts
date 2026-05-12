import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ErrorDialog, ErrorDialogData, UiFatalException } from '@taro/ui-shared';
import { DapFatalException } from '@taro/dap-core';

@Injectable()
export class GlobalFatalErrorHandler implements ErrorHandler {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  public handleError(error: any): void {
    // Unwrap the error if it comes from an RxJS or Zone.js wrapper
    const unwrappedError = error.rejection ? error.rejection : (error.originalError || error);

    const isFatal = unwrappedError instanceof DapFatalException || 
                    unwrappedError instanceof UiFatalException ||
                    unwrappedError.name === 'DapFatalException' ||
                    unwrappedError.name === 'UiFatalException';

    if (isFatal) {
      // Zone is required because global error handlers may trigger outside the Angular zone
      this.zone.run(() => this.showFatalDialog(unwrappedError.message));
    } else {
      // Log standard errors normally to console
      console.error(error);
    }
  }

  private showFatalDialog(message: string): void {
    const dialogRef = this.dialog.open(ErrorDialog, {
      width: '400px',
      disableClose: true,
      data: {
        title: 'Fatal Error',
        message: message,
        hideRetry: true
      } as ErrorDialogData
    });

    dialogRef.afterClosed().subscribe(() => {
      this.router.navigate(['/setup']);
    });
  }
}
