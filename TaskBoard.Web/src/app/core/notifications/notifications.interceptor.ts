import { HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { NotificationService } from './notification.service';

/** Cambios en hábitos o tareas: POST/PUT/DELETE a /Habits, /Tasks o /tasks/{id}/timeentries. */
const AFFECTS_REMINDERS = /\/api\/(habits|tasks)\b/i;

/**
 * Tras cualquier cambio que afecte a los recordatorios, se recalculan las notificaciones.
 * Así ningún componente tiene que acordarse de avisar: es un punto único, como un
 * HandlerInterceptor (postHandle) en Spring MVC.
 */
export const notificationsInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || !AFFECTS_REMINDERS.test(req.url)) {
    return next(req);
  }

  // inject() se resuelve al hacer la petición, no al crear HttpClient: sin dependencia circular
  const notifications = inject(NotificationService);
  return next(req).pipe(
    tap(event => {
      if (event.type === HttpEventType.Response && event.ok) {
        notifications.refreshSoon();
      }
    })
  );
};
