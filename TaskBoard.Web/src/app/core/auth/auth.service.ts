import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthRequest, AuthResponse } from './auth.models';

const TOKEN_KEY = 'taskboard_token';
const REFRESH_KEY = 'taskboard_refresh_token';
const EMAIL_KEY = 'taskboard_email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/Auth`;

  // Estado interno (escribible solo desde aquí)
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _refreshToken = signal<string | null>(localStorage.getItem(REFRESH_KEY));
  private readonly _email = signal<string | null>(localStorage.getItem(EMAIL_KEY));

  /** Refresh en curso: si varias peticiones fallan a la vez con 401, todas esperan a ESTE mismo. */
  private refreshInFlight$: Observable<string> | null = null;

  // Estado público (solo lectura para el resto de la app)
  readonly token = this._token.asReadonly();
  readonly email = this._email.asReadonly();

  /**
   * Hay sesión mientras exista un refresh token. El access token caduca pronto y se renueva solo,
   * así que ya NO sirve para saber si el usuario sigue dentro (si no, el guard lo echaría a los 15 min).
   */
  readonly isAuthenticated = computed(() => this._refreshToken() !== null);

  login(request: AuthRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, request)
      .pipe(tap(response => this.saveSession(response)));
  }

  register(request: AuthRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register`, request)
      .pipe(tap(response => this.saveSession(response)));
  }

  /** Pide el email de recuperación. El servidor responde igual exista o no la cuenta. */
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/forgot-password`, { email });
  }

  /** Cambia la contraseña con el token del enlace del email. */
  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reset-password`, { token, newPassword });
  }

  /**
   * Cambia el refresh token por un access token nuevo (y un refresh nuevo: rotación).
   * Devuelve el access token nuevo. Compartido: una sola petición aunque la pidan varios a la vez.
   */
  refresh(): Observable<string> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const sent = this._refreshToken();
    if (!sent) {
      return throwError(() => new Error('No hay sesión que renovar.'));
    }

    this.refreshInFlight$ = this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, { refreshToken: sent }).pipe(
      tap(response => this.saveSession(response)),
      map(response => response.token),
      catchError((error: unknown) => {
        // Otra pestaña pudo rotar el token un instante antes: el nuestro ya está gastado,
        // pero en localStorage hay uno nuevo y válido. Lo adoptamos en vez de cerrar la sesión.
        const stored = localStorage.getItem(REFRESH_KEY);
        if (error instanceof HttpErrorResponse && error.status === 401 && stored && stored !== sent) {
          this.loadFromStorage();
          return of(localStorage.getItem(TOKEN_KEY) ?? '');
        }
        return throwError(() => error);
      }),
      finalize(() => (this.refreshInFlight$ = null)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.refreshInFlight$;
  }

  /**
   * Cierra la sesión. Con revoke=true (botón "Cerrar sesión") avisa al servidor para invalidar el
   * refresh token; con false (sesión ya inválida) solo limpia el estado local.
   */
  logout(revoke = true): void {
    const refreshToken = this._refreshToken();
    if (revoke && refreshToken) {
      // Fire-and-forget: si falla (offline), el usuario sale igualmente y el token caducará solo.
      this.http.post(`${this.baseUrl}/logout`, { refreshToken }).subscribe({ error: () => undefined });
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EMAIL_KEY);
    this._token.set(null);
    this._refreshToken.set(null);
    this._email.set(null);
    this.router.navigate(['/login']);
  }

  private saveSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(REFRESH_KEY, response.refreshToken);
    localStorage.setItem(EMAIL_KEY, response.email);
    this._token.set(response.token);
    this._refreshToken.set(response.refreshToken);
    this._email.set(response.email);
  }

  private loadFromStorage(): void {
    this._token.set(localStorage.getItem(TOKEN_KEY));
    this._refreshToken.set(localStorage.getItem(REFRESH_KEY));
    this._email.set(localStorage.getItem(EMAIL_KEY));
  }
}
