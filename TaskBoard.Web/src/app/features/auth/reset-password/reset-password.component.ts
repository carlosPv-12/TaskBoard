import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';

/** El campo "repetir" debe coincidir con la contraseña. */
function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value && control.value !== password ? { mismatch: true } : null;
}

/** Destino del enlace del email: /reset-password?token=... */
@Component({
  selector: 'app-reset-password',
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
  templateUrl: './reset-password.component.html',
  styleUrls: ['../auth-shared.scss']
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  private readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly hasToken = !!this.token;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    confirm: ['', [Validators.required, matchesPassword]]
  });

  constructor() {
    // Si cambia la contraseña, hay que volver a comprobar que "repetir" sigue coincidiendo.
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirm.updateValueAndValidity());
  }

  submit(): void {
    if (!this.token) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.resetPassword(this.token, this.form.controls.password.value).subscribe({
      next: () => {
        // El servidor ya cerró todas las sesiones; limpiamos también la de este navegador y vamos al login.
        this.auth.logout(false);
        this.snackBar.open('Contraseña actualizada. Ya puedes iniciar sesión.', 'Cerrar', { duration: 6000 });
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
    if (error.status === 429) {
      return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    }
    if (error.status === 400) {
      return error.error?.error ?? 'La contraseña debe tener entre 8 y 100 caracteres.';
    }
    return 'No se pudo cambiar la contraseña. Inténtalo de nuevo.';
  }
}
