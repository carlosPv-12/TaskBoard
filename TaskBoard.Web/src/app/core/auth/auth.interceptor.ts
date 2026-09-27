import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isAuthEndpoint = req.url.startsWith(`${environment.apiUrl}/Auth`);

  // Las peticiones son inmutables: se clona con la cabecera añadida
  const request =
    token && isApiRequest && !isAuthEndpoint
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        auth.logout();
      }
      return throwError(() => error);
    })
  );
};