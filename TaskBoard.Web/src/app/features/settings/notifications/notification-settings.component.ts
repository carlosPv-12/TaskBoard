import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NotificationService } from '../../../core/notifications/notification.service';
import { NotificationSettingsService } from '../../../core/notifications/notification-settings.service';
import { STALE_TASK_DAYS, TASKS_TIME } from '../../../core/notifications/notification-planner';
import { NotificationSettings } from '../../../core/notifications/reminder.models';
import { TimeStepperComponent } from '../../../shared/components/time-stepper/time-stepper.component';

/** Ajustes → Notificaciones: recordatorios de hábitos y de tareas olvidadas (por dispositivo). */
@Component({
  selector: 'app-notification-settings',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatSlideToggleModule, TimeStepperComponent],
  templateUrl: './notification-settings.component.html',
  styleUrls: ['../settings-shared.scss', './notification-settings.component.scss']
})
export class NotificationSettingsComponent {
  protected readonly notifications = inject(NotificationService);
  private readonly settingsService = inject(NotificationSettingsService);

  protected readonly settings = this.settingsService.settings;
  protected readonly staleDays = STALE_TASK_DAYS;
  protected readonly tasksTime = TASKS_TIME;

  /** El selector de hora se despliega bajo la fila, como en Ajustes de iOS. */
  protected readonly timeOpen = signal(false);

  /** Solo el primer aviso programado: suficiente para saber que todo está en marcha. */
  protected readonly nextNotification = computed(() => this.notifications.upcoming()[0] ?? null);

  update(changes: Partial<NotificationSettings>): void {
    this.settingsService.update(changes);
  }

  setHabitsTime(value: string): void {
    this.update({ habitsTime: value });
  }

  toggleTime(): void {
    if (this.settings().habitsEnabled) {
      this.timeOpen.update(open => !open);
    }
  }
}
