import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';

/** "Repetir" debe coincidir con la nueva contraseña. */
function matchesNewPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('newPassword')?.value;
  return control.value && control.value !== password ? { mismatch: true } : null;
}

/** La nueva no puede ser igual que la actual (el servidor también lo comprueba). */
function differsFromCurrent(control: AbstractControl): ValidationErrors | null {
  const current = control.parent?.get('currentPassword')?.value;
  return control.value && control.value === current ? { sameAsCurrent: true } : null;
}

/** Ajustes → Cambiar contraseña. Al terminar, el resto de dispositivos tendrán que volver a entrar. */
@Component({
  selector: 'app-change-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './change-password.component.html',
  styleUrls: ['../settings-shared.scss', './change-password.component.scss']
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hide = signal(true);

  readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100), differsFromCurrent]],
    confirm: ['', [Validators.required, matchesNewPassword]]
  });

  constructor() {
    // Los validadores cruzados miran otro campo: hay que revalidar cuando ese otro cambia
    const { currentPassword, newPassword, confirm } = this.form.controls;
    currentPassword.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => newPassword.updateValueAndValidity());
    newPassword.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => confirm.updateValueAndValidity());
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.snackBar.open('Contraseña actualizada. Se ha cerrado la sesión en tus otros dispositivos.', 'Vale', {
          duration: 6000
        });
        void this.router.navigate(['/settings']);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(
          error.status === 429
            ? 'Demasiados intentos. Espera un minuto y vuelve a probar.'
            : (error.error?.error ?? 'No se pudo cambiar la contraseña. Inténtalo de nuevo.')
        );
        if (error.status === 400) {
          this.form.controls.currentPassword.reset('');
        }
      }
    });
  }
}
