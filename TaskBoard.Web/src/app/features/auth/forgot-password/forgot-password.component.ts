import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

/** Pide el email y manda el enlace de recuperación. Siempre muestra el mismo mensaje de éxito. */
@Component({
  selector: 'app-forgot-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../auth-shared.scss']
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly sentTo = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.getRawValue();
    const trimmed = email.trim();

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.forgotPassword(trimmed).subscribe({
      next: () => {
        this.loading.set(false);
        this.sentTo.set(trimmed);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(this.toMessage(error));
      }
    });
  }

  /** Volver al formulario (por si se equivocó de email). */
  retry(): void {
    this.sentTo.set(null);
  }

  private toMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No se puede conectar con el servidor. ¿Está el backend arrancado?';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    }
    return 'No se pudo procesar la solicitud. Inténtalo de nuevo.';
  }
}
