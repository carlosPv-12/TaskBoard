import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { NotificationSettingsService } from '../../core/notifications/notification-settings.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

/** Portada de Ajustes: cuenta, accesos a cada apartado y cerrar sesión. */
@Component({
  selector: 'app-settings',
  imports: [RouterLink, MatIconModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings-shared.scss', './settings.component.scss']
})
export class SettingsComponent {
  protected readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly notificationSettings = inject(NotificationSettingsService);
  private readonly dialog = inject(MatDialog);

  /** Inicial del email para el avatar. */
  protected readonly initial = computed(() => (this.auth.email() ?? '?').charAt(0).toUpperCase());

  /** Resumen a la derecha de la fila, como "Activadas" en Ajustes de iOS. */
  protected readonly notificationsSummary = computed(() => {
    if (!this.notifications.supported) return 'Solo en Android';
    if (this.notifications.permission() === 'denied') return 'Bloqueadas';

    const { habitsEnabled, habitsTime, tasksEnabled } = this.notificationSettings.settings();
    if (habitsEnabled) return habitsTime;
    return tasksEnabled ? 'Solo tareas' : 'Desactivadas';
  });

  logout(): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '380px',
        data: {
          title: 'Cerrar sesión',
          message: 'Tendrás que volver a introducir tu email y contraseña. Los recordatorios de este dispositivo se desactivarán.',
          confirmText: 'Cerrar sesión',
          destructive: true
        }
      })
      .afterClosed()
      .pipe(filter(confirmed => confirmed === true))
      .subscribe(() => this.auth.logout());
  }
}
