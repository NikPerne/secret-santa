import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './api/auth.service';

/** Sends signed-out visitors to the sign-in page, remembering where they wanted to go. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ready();
  return user ? true : router.createUrlTree(['/signin'], { queryParams: { redirect: state.url } });
};
