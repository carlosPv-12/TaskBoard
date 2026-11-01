import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/notifications/notification.service';
import { NotificationSettingsService } from '../../core/notifications/notification-settings.service';
import { STALE_TASK_DAYS, TASKS_TIME } from '../../core/notifications/notification-planner';
import { NotificationSettings } from '../../core/notifications/reminder.models';

/** Ajustes del dispositivo: recordatorios de hábitos y de tareas olvidadas. */
@Component({
  selector: 'app-settings',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatSlideToggleModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  protected readonly notifications = inject(NotificationService);
  private readonly settingsService = inject(NotificationSettingsService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly settings = this.settingsService.settings;
  protected readonly staleDays = STALE_TASK_DAYS;
  protected readonly tasksTime = TASKS_TIME;

  update(changes: Partial<NotificationSettings>): void {
    this.settingsService.update(changes);
  }

  onTimeChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (/^\d{2}:\d{2}$/.test(value)) {
      this.update({ habitsTime: value });
    }
  }

  async test(): Promise<void> {
    await this.notifications.sendTest();
    if (this.notifications.permission() === 'granted') {
      this.snackBar.open('Llegará en 5 segundos. Puedes salir de la app para verla.', 'Vale', { duration: 4000 });
    }
  }
}
