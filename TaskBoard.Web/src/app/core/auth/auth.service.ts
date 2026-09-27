import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthRequest, AuthResponse } from './auth.models';

const TOKEN_KEY = 'taskboard_token';
const EMAIL_KEY = 'taskboard_email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/Auth`;

  // Estado interno (escribible solo desde aquí)
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _email = signal<string | null>(localStorage.getItem(EMAIL_KEY));

  // Estado público (solo lectura para el resto de la app)
  readonly token = this._token.asReadonly();
  readonly email = this._email.asReadonly();
  readonly isAuthenticated = computed(() => {
    const token = this._token();
    return token !== null && !this.isExpired(token);
  });

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

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    this._token.set(null);
    this._email.set(null);
    this.router.navigate(['/login']);
  }

  private saveSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(EMAIL_KEY, response.email);
    this._token.set(response.token);
    this._email.set(response.email);
  }

  /** Lee el campo "exp" del payload del JWT (sin verificar firma: eso lo hace el backend). */
  private isExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}