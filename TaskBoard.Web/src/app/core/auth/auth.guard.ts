import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Solo deja pasar a usuarios autenticados. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Devolver un UrlTree = "cancela esta navegación y ve aquí"
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

/** Solo deja pasar a usuarios SIN sesión (pantalla de login). */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/tasks']) : true;
};