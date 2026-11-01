/** Respuesta de GET /api/Reminders: el estado justo para decidir qué avisar. */
export interface Reminders {
  date: string; // día local enviado por el móvil, "yyyy-MM-dd"
  weekStart: string; // lunes de esa semana
  habits: HabitReminder[];
  tasks: TaskReminder[];
}

export interface HabitReminder {
  id: number;
  name: string;
  timesPerWeek: number;
  doneThisWeek: number;
  doneToday: boolean;
}

export interface TaskReminder {
  id: number;
  title: string;
  lastActivityAt: string; // ISO UTC
}

/** Ajustes guardados en el propio dispositivo. */
export interface NotificationSettings {
  habitsEnabled: boolean;
  /** "HH:mm" */
  habitsTime: string;
  tasksEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  habitsEnabled: true,
  habitsTime: '20:00',
  tasksEnabled: true
};

/** Una notificación ya decidida: cuándo, qué dice y a qué pantalla lleva al pulsarla. */
export interface PlannedNotification {
  id: number;
  at: Date;
  title: string;
  body: string;
  route: string;
}
