import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isAuthEndpoint = req.url.startsWith(`${environment.apiUrl}/Auth`);

  // Las peticiones son inmutables: se clona con la cabecera añadida
  const withToken = (token: string | null) =>
    token && isApiRequest && !isAuthEndpoint
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(withToken(auth.token())).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo un 401 en una petición de datos significa "access token caducado".
      if (error.status !== 401 || !isApiRequest || isAuthEndpoint) {
        return throwError(() => error);
      }

      // Renovar el token y repetir la petición original, sin que el usuario se entere.
      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          // Solo se cierra la sesión si el servidor la rechaza (401) o no hay sesión que renovar.
          // Sin red o con el servidor caído (status 0 / 5xx) se conserva: el usuario sigue dentro.
          const sessionInvalid = !(refreshError instanceof HttpErrorResponse) || refreshError.status === 401;
          if (sessionInvalid) {
            auth.logout(false);
          }
          return throwError(() => error);
        }),
        switchMap(newToken => next(withToken(newToken)))
      );
    })
  );
};
