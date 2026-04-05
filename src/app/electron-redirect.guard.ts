import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EnvironmentDetectService } from './environment-detect.service';

/**
 * Electron Redirect Guard (Functional)
 * Determines whether the user should be routed to the web setup page or the electron setup page.
 */
export const electronRedirectGuard: CanActivateFn = () => {
  const envDetect = inject(EnvironmentDetectService);
  const router = inject(Router);

  if (envDetect.isElectron()) {
    return router.createUrlTree(['/setup-electron']);
  } else {
    return router.createUrlTree(['/setup-web']);
  }
};
