import { addDays, parseIsoDate, startOfWeek, toIsoDate } from '../../shared/utils/local-date';
import { NotificationSettings, PlannedNotification, Reminders } from './reminder.models';

/**
 * Decide QUÉ notificaciones programar para los próximos días a partir del estado actual.
 * Es una función pura (entrada → salida, sin Angular ni Capacitor): se puede probar con
 * datos inventados y una fecha fija, como un servicio de dominio sin dependencias en Java.
 *
 * Cada vez que abres la app o cambias algo se vuelve a calcular todo y se sustituye lo
 * programado, así que las proyecciones a futuro ("si no haces nada más...") se corrigen solas.
 */

export const PLAN_DAYS = 7;
/** Días sin registrar tiempo para considerar una tarea olvidada (y cada cuánto se repite el aviso). */
export const STALE_TASK_DAYS = 7;
/** Hora fija del aviso de tareas olvidadas. */
export const TASKS_TIME = '10:00';

/** Rangos de IDs: así se pueden cancelar los nuestros sin tocar otros. */
export const HABIT_ID_BASE = 100;
export const TASK_ID_BASE = 200;
export const TEST_ID = 999;

export function planNotifications(
  data: Reminders,
  settings: NotificationSettings,
  now: Date = new Date()
): PlannedNotification[] {
  const plan: PlannedNotification[] = [];
  const today = toIsoDate(now);

  for (let offset = 0; offset < PLAN_DAYS; offset++) {
    const day = addDays(today, offset);

    if (settings.habitsEnabled) {
      const at = atTime(day, settings.habitsTime);
      const body = at > now ? habitsBody(data, day, offset === 0) : null;
      if (body) {
        plan.push({ id: HABIT_ID_BASE + offset, at, title: 'Hábitos de hoy', body, route: '/habits' });
      }
    }

    if (settings.tasksEnabled) {
      const at = atTime(day, TASKS_TIME);
      const body = at > now ? staleTasksBody(data, day) : null;
      if (body) {
        plan.push({ id: TASK_ID_BASE + offset, at, title: 'Tareas olvidadas', body, route: '/tasks' });
      }
    }
  }

  return plan;
}

/**
 * Un hábito "toca" ese día si no está hecho y lo que falta para el objetivo semanal ya no cabe
 * en los días que quedan sin él. Así un diario avisa cada día y uno de 3×/semana solo cuando
 * empieza a ir justo (p. ej. el viernes si aún no llevas ninguno), sin agobiar el lunes.
 */
function habitsBody(data: Reminders, day: string, isToday: boolean): string | null {
  const sameWeek = startOfWeek(day) === data.weekStart;
  const daysLeft = 7 - mondayIndex(day); // incluye el propio día

  const due = data.habits.filter(habit => {
    if (isToday && habit.doneToday) return false;
    // Para días futuros se asume que no harás nada más hasta entonces; en otra semana se empieza de cero
    const done = sameWeek ? habit.doneThisWeek : 0;
    const remaining = habit.timesPerWeek - done;
    return remaining > 0 && remaining >= daysLeft;
  });

  if (due.length === 0) return null;
  const names = listNames(due.map(habit => habit.name));
  return due.length === 1 ? `Hoy toca ${names}` : `Te quedan ${names}`;
}

/** Aviso el día que una tarea cumple 7, 14, 21… días sin avanzar (no todos los días, para no insistir). */
function staleTasksBody(data: Reminders, day: string): string | null {
  const dayNumber = toDayNumber(day);

  const stale = data.tasks
    .map(task => ({ task, idle: dayNumber - toDayNumber(toIsoDate(new Date(task.lastActivityAt))) }))
    .filter(({ idle }) => idle >= STALE_TASK_DAYS && idle % STALE_TASK_DAYS === 0);

  if (stale.length === 0) return null;
  if (stale.length === 1) {
    const { task, idle } = stale[0];
    return `«${task.title}» lleva ${idle} días sin avanzar`;
  }
  return `${stale.length} tareas llevan una semana o más sin avanzar: ${listNames(stale.map(s => s.task.title), 2)}`;
}

/** «Leer», «Leer» y «Seda dental», «Leer», «Seda dental» y 2 más */
function listNames(names: string[], max = 3): string {
  const quoted = names.map(name => `«${name}»`);
  if (quoted.length === 1) return quoted[0];
  if (quoted.length <= max) return `${quoted.slice(0, -1).join(', ')} y ${quoted.at(-1)}`;
  return `${quoted.slice(0, max).join(', ')} y ${quoted.length - max} más`;
}

function atTime(isoDay: string, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = parseIsoDate(isoDay);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

/** Lunes = 0 … domingo = 6 (getDay() empieza en domingo). */
function mondayIndex(isoDay: string): number {
  return (parseIsoDate(isoDay).getDay() + 6) % 7;
}

/** Número de día absoluto (sin horas ni cambios de horario) para restar fechas. */
function toDayNumber(isoDay: string): number {
  const [y, m, d] = isoDay.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
