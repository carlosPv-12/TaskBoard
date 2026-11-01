import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthRequest, AuthResponse } from './auth.models';

const TOKEN_KEY = 'taskboard_token';
const REFRESH_KEY = 'taskboard_refresh_token';
const EMAIL_KEY = 'taskboard_email';
const SESSION_KEYS = [TOKEN_KEY, REFRESH_KEY, EMAIL_KEY];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/Auth`;

  /**
   * Dónde vive la sesión:
   *  - localStorage: "Mantener la sesión iniciada" (sobrevive a cerrar el navegador; el refresh token dura 30 días).
   *  - sessionStorage: se borra al cerrar el navegador (útil en un ordenador que no es tuyo).
   * Al arrancar se detecta cuál tiene la sesión; si ninguna, se usa localStorage.
   */
  private storage: Storage = sessionStorage.getItem(REFRESH_KEY) ? sessionStorage : localStorage;

  // Estado interno (escribible solo desde aquí)
  private readonly _token = signal<string | null>(this.storage.getItem(TOKEN_KEY));
  private readonly _refreshToken = signal<string | null>(this.storage.getItem(REFRESH_KEY));
  private readonly _email = signal<string | null>(this.storage.getItem(EMAIL_KEY));

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

  /** remember = false → la sesión termina al cerrar el navegador. */
  login(request: AuthRequest, remember = true): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, request)
      .pipe(tap(response => this.saveSession(response, remember)));
  }

  register(request: AuthRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register`, request)
      .pipe(tap(response => this.saveSession(response, true)));
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
   * Cambia la contraseña con la sesión iniciada. El servidor cierra la sesión en los demás
   * dispositivos y devuelve tokens nuevos para este, que se guardan donde ya estaba la sesión.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/change-password`, { currentPassword, newPassword })
      .pipe(
        tap(response => this.saveSession(response)),
        map(() => undefined)
      );
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
      // Sin "remember": se guarda donde ya estaba la sesión
      tap(response => this.saveSession(response)),
      map(response => response.token),
      catchError((error: unknown) => {
        // Otra pestaña pudo rotar el token un instante antes: el nuestro ya está gastado,
        // pero en el almacenamiento hay uno nuevo y válido. Lo adoptamos en vez de cerrar la sesión.
        const stored = this.storage.getItem(REFRESH_KEY);
        if (error instanceof HttpErrorResponse && error.status === 401 && stored && stored !== sent) {
          this.loadFromStorage();
          return of(this.storage.getItem(TOKEN_KEY) ?? '');
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

    this.clear(localStorage);
    this.clear(sessionStorage);
    this.storage = localStorage;
    this._token.set(null);
    this._refreshToken.set(null);
    this._email.set(null);
    this.router.navigate(['/login']);
  }

  /** remember definido = login (elige dónde guardar); undefined = renovación (sigue en el mismo sitio). */
  private saveSession(response: AuthResponse, remember?: boolean): void {
    if (remember !== undefined) {
      const target = remember ? localStorage : sessionStorage;
      if (target !== this.storage) {
        this.clear(this.storage); // que no quede una sesión vieja en el otro almacenamiento
        this.storage = target;
      }
    }

    this.storage.setItem(TOKEN_KEY, response.token);
    this.storage.setItem(REFRESH_KEY, response.refreshToken);
    this.storage.setItem(EMAIL_KEY, response.email);
    this._token.set(response.token);
    this._refreshToken.set(response.refreshToken);
    this._email.set(response.email);
  }

  private loadFromStorage(): void {
    this._token.set(this.storage.getItem(TOKEN_KEY));
    this._refreshToken.set(this.storage.getItem(REFRESH_KEY));
    this._email.set(this.storage.getItem(EMAIL_KEY));
  }

  private clear(storage: Storage): void {
    SESSION_KEYS.forEach(key => storage.removeItem(key));
  }
}
