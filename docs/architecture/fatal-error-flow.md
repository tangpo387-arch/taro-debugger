---
title: How-To: Fatal Error Handling & Redirection
scope: error-handling, navigation, architecture
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-05-12
---

# Fatal Error Handling & Redirection Flow

This guide defines the standardized procedure for throwing a fatal exception that triggers a global error dialog and redirects the user to the setup page upon dismissal.

## 1. Goal

Provide a robust, user-friendly recovery mechanism for critical failures (e.g., connection loss, invalid configuration, or unrecoverable DAP state) that requires returning to the initial setup phase.

## 2. Prerequisites

- **Angular Material Dialog**: Used for rendering the `ErrorDialog`.
- **Router**: Used for navigation.
- **DapSessionService**: For session cleanup.

## 3. Implementation Steps

### 3.1 Define the Fatal Error Exceptions

To maintain a clean separation of concerns, we define two distinct fatal exception types:

#### 3.1.1 DapFatalException (Core Layer)

In `projects/dap-core/src/lib/session/dap-session.service.ts`, define the core-level exception:

```typescript
/** 
 * Exception thrown when the DAP session or transport encounters an 
 * unrecoverable protocol-level failure.
 */
export class DapFatalException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DapFatalException';
  }
}
```

#### 3.1.2 UiFatalException (UI Layer)

In `projects/ui-shared/src/lib/ui-error.ts` (new file), define the UI-level exception shared across feature libraries:

```typescript
/** 
 * Exception thrown when a UI component or layout system encounters 
 * an unrecoverable failure.
 */
export class UiFatalException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UiFatalException';
  }
}
```

### 3.2 Throwing the Exception

Each layer should use the exception type appropriate to its scope:

- **Transport/Session Layer**: Use `DapFatalException`.
- **UI Libraries (Assembly, Console, etc.)**: Use `UiFatalException` from `@taro/ui-shared`.

```typescript
// Example: Throwing from Session Layer (dap-core)
throw new DapFatalException('DAP adapter process terminated unexpectedly.');

// Example: Throwing from UI Component (ui-shared consumer)
throw new UiFatalException('Failed to mount critical UI layout component.');
```

### 3.3 Catching via Global ErrorHandler (Asynchronous Support)

To ensure that fatal exceptions are caught regardless of where they are thrown (including asynchronous RxJS streams or WebSocket events), implement a custom Angular `ErrorHandler` in the Host Application layer.

```typescript
import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ErrorDialog, ErrorDialogData } from '@taro/ui-shared';
import { DapFatalException } from '@taro/dap-core';
import { UiFatalException } from '@taro/ui-shared';

@Injectable()
export class GlobalFatalErrorHandler implements ErrorHandler {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private zone = inject(NgZone);

  handleError(error: any): void {
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
      // Log standard errors normally
      console.error(error);
    }
  }

  private showFatalDialog(message: string): void {
    const dialogRef = this.dialog.open(ErrorDialog, {
      width: '400px',
      disableClose: true,
      data: {
        title: 'Fatal Error',
        message: message
      } as ErrorDialogData
    });

    dialogRef.afterClosed().subscribe(() => {
      this.router.navigate(['/setup']);
    });
  }
}
```

Then, provide it in your application bootstrap config:

```typescript
import { ErrorHandler, ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalFatalErrorHandler },
    // ...
  ]
};
```

## 4. Verification

1. **Triggering**: Mock a service to asynchronously throw `FatalErrorException` (e.g., inside a `setTimeout` or an RxJS `subscribe` block).
2. **Global Catch Check**: Verify that the application does not simply crash and that the `GlobalFatalErrorHandler` intercepts the exception.
3. **Dialog Check**: Verify the `ErrorDialog` appears with the correct message and "GO BACK" button.
4. **Navigation Check**: Verify that clicking "GO BACK" (or any close action) navigates the app to `/setup`.
5. **Cleanup Check**: Ensure `DapSessionService.disconnect()` is called during the redirection.

## 5. Constraints

- **Session Reset**: You MUST call `session.disconnect()` or `session.reset()` before or during redirection to ensure no background traffic continues.
- **Persistence**: Do not persist the error state to `localStorage`; the setup page should start from a clean slate.
