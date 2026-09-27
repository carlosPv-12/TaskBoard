import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
   private readonly route = inject(ActivatedRoute);

  readonly mode = signal<AuthMode>('login');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  toggleMode(): void {
    this.mode.update(current => (current === 'login' ? 'register' : 'login'));
    this.errorMessage.set(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const request = this.form.getRawValue();
    const action$ = this.mode() === 'login'
      ? this.auth.login(request)
      : this.auth.register(request);

     action$.subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/tasks';
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(this.toMessage(error));
      }
    });
  }

  private toMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No se puede conectar con el servidor. ¿Está el backend arrancado?';
    }
    if (error.status === 401) {
      return 'Email o contraseña incorrectos.';
    }
    if (error.status === 400 || error.status === 409) {
      return this.mode() === 'register'
        ? 'No se pudo crear la cuenta. Puede que el email ya esté registrado.'
        : 'Los datos enviados no son válidos.';
    }
    return 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
  }
}