import { Injectable, NgZone, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Capacitor, PermissionState } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { environment } from '../../../environments/environment';
import { todayIso } from '../../shared/utils/local-date';
import { AuthService } from '../auth/auth.service';
import { NotificationSettingsService } from './notification-settings.service';
import { HABIT_ID_BASE, TASK_ID_BASE, planNotifications } from './notification-planner';
import { PlannedNotification, Reminders } from './reminder.models';

const CHANNEL_ID = 'reminders';

/**
 * Programa las notificaciones LOCALES del móvil. No hay servidor enviando nada:
 * Android las guarda (AlarmManager) y las muestra a su hora aunque la app esté cerrada.
 *
 * Flujo: pedir estado a la API → planNotifications() decide → se cancelan las nuestras
 * pendientes → se programan las nuevas. Se repite al abrir la app, al volver a ella,
 * al cambiar ajustes y tras cualquier cambio en hábitos o tareas (ver interceptor).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly auth = inject(AuthService);
  private readonly settingsService = inject(NotificationSettingsService);

  /** Solo dentro del APK: en el navegador no hay notificaciones programadas con la app cerrada. */
  readonly supported = Capacitor.isNativePlatform();
  readonly permission = signal<PermissionState | 'unknown'>('unknown');
  /** Lo último que se programó (para mostrarlo en Ajustes). */
  readonly upcoming = signal<PlannedNotification[]>([]);
  readonly lastError = signal<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private rerun = false;

  constructor() {
    if (!this.supported) return;

    void this.setup();

    // Sesión iniciada → programar; sesión cerrada → borrar todo (no avisar de datos de otro usuario)
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      this.settingsService.settings(); // también se recalcula al cambiar ajustes
      if (authenticated) {
        this.refreshSoon(0);
      } else {
        void this.cancelOurs().then(() => this.upcoming.set([]));
      }
    });
  }

  /** Agrupa varios cambios seguidos (marcar 3 hábitos) en un único recálculo. */
  refreshSoon(delayMs = 1500): void {
    if (!this.supported) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, delayMs);
  }

  async requestPermission(): Promise<void> {
    if (!this.supported) return;
    const { display } = await LocalNotifications.requestPermissions();
    this.permission.set(display);
    if (display === 'granted') this.refreshSoon(0);
  }

  // ── Interno ─────────────────────────────────────────────
  private async setup(): Promise<void> {
    try {
      // Android 8+: toda notificación pertenece a un canal, que el usuario puede ajustar en Ajustes del sistema
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Recordatorios',
        description: 'Hábitos pendientes y tareas olvidadas',
        importance: 4,
        visibility: 1
      });

      const { display } = await LocalNotifications.checkPermissions();
      this.permission.set(display);
    } catch {
      this.permission.set('unknown');
    }

    // Al pulsar una notificación se abre la pantalla correspondiente
    void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) =>
      this.zone.run(() => void this.router.navigateByUrl(notification.extra?.route ?? '/'))
    );

    // Al volver a la app (puede haber pasado un día entero) se recalcula
    void App.addListener('resume', () => this.zone.run(() => this.refreshSoon(0)));
  }

  private async refresh(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;

    try {
      if (!this.auth.isAuthenticated()) return;

      const settings = this.settingsService.settings();
      if (!settings.habitsEnabled && !settings.tasksEnabled) {
        await this.cancelOurs();
        this.upcoming.set([]);
        return;
      }

      if (!(await this.ensurePermission())) return;

      const data = await firstValueFrom(
        this.http.get<Reminders>(`${environment.apiUrl}/Reminders`, { params: { date: todayIso() } })
      );
      const plan = planNotifications(data, settings);

      await this.cancelOurs();
      if (plan.length > 0) {
        await LocalNotifications.schedule({ notifications: plan.map(p => this.toNative(p)) });
      }

      this.upcoming.set(plan);
      this.lastError.set(null);
    } catch {
      // Sin red: se mantiene lo que ya estaba programado y se reintenta en la próxima ocasión
      this.lastError.set('No se pudieron actualizar los recordatorios (¿sin conexión?).');
    } finally {
      this.running = false;
      if (this.rerun) {
        this.rerun = false;
        this.refreshSoon(0);
      }
    }
  }

  /** Pide permiso solo si aún no se ha decidido (Android 13+ lo pregunta una vez). */
  private async ensurePermission(): Promise<boolean> {
    let { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      ({ display } = await LocalNotifications.requestPermissions());
    }
    this.permission.set(display);
    return display === 'granted';
  }

  /** Cancela solo las nuestras (rangos de hábitos y tareas). */
  private async cancelOurs(): Promise<void> {
    const { notifications } = await LocalNotifications.getPending();
    const ours = notifications.filter(n => n.id >= HABIT_ID_BASE && n.id < TASK_ID_BASE + 100);
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) });
    }
  }

  private toNative(planned: PlannedNotification) {
    return {
      id: planned.id,
      title: planned.title,
      body: planned.body,
      largeBody: planned.body,
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_taskboard',
      iconColor: '#0A84FF',
      schedule: { at: planned.at, allowWhileIdle: true },
      extra: { route: planned.route }
    };
  }
}
