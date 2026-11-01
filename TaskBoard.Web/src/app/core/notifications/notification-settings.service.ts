import { Injectable, signal } from '@angular/core';
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings } from './reminder.models';

const STORAGE_KEY = 'tb.notifications';

/**
 * Ajustes de notificaciones, guardados en el dispositivo (localStorage, que en el APK
 * persiste igual que en el navegador). Son por dispositivo a propósito: puedes querer
 * avisos en el móvil y no en otro.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSettingsService {
  private readonly _settings = signal<NotificationSettings>(this.read());
  readonly settings = this._settings.asReadonly();

  update(changes: Partial<NotificationSettings>): void {
    const next = { ...this._settings(), ...changes };
    this._settings.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento (modo privado): los ajustes duran lo que la sesión
    }
  }

  private read(): NotificationSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_SETTINGS;
    } catch {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  }
}
