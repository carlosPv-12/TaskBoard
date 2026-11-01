export interface Habit {
  id: number;
  name: string;
  /** Objetivo semanal (1–7). 7 = diario. Cualquier día de la semana cuenta. */
  timesPerWeek: number;
  createdAt: string;
}

export interface CreateHabitRequest {
  name: string;
  timesPerWeek: number;
}

export interface UpdateHabitRequest {
  name: string;
  timesPerWeek: number;
}

export interface HabitLog {
  habitId: number;
  date: string; // DateOnly → "yyyy-MM-dd"
  completed: boolean;
}

export interface ToggleHabitLogRequest {
  date: string;
  completed: boolean;
}

export type StreakUnit = 'days' | 'weeks';

export interface HabitStats {
  habitName: string;
  timesPerWeek: number;
  totalLogs: number;
  completedLogs: number;
  completionRate: number;
  currentStreak: number;
  /** Diario → racha en días; resto → semanas seguidas cumpliendo el objetivo. */
  streakUnit: StreakUnit;
}

/** Posición en el ranking de constancia (para los distintivos). */
export type HabitRank = 'best' | 'worst' | null;

export const MIN_TIMES_PER_WEEK = 1;
export const MAX_TIMES_PER_WEEK = 7;

/** "Diario", "1 vez por semana", "3 veces por semana". */
export function frequencyLabel(timesPerWeek: number): string {
  if (timesPerWeek >= MAX_TIMES_PER_WEEK) return 'Diario';
  return timesPerWeek === 1 ? '1 vez por semana' : `${timesPerWeek} veces por semana`;
}

/** Versión corta para la rejilla: "Diario", "3×/sem". */
export function frequencyShortLabel(timesPerWeek: number): string {
  return timesPerWeek >= MAX_TIMES_PER_WEEK ? 'Diario' : `${timesPerWeek}×/sem`;
}

/** "1 día", "4 días", "1 semana", "3 semanas". */
export function streakUnitLabel(value: number, unit: StreakUnit): string {
  if (unit === 'weeks') return value === 1 ? 'semana' : 'semanas';
  return value === 1 ? 'día' : 'días';
}

/** Racha expresada en días, para poder comparar hábitos diarios con semanales. */
export function streakInDays(stats: HabitStats): number {
  return stats.streakUnit === 'weeks' ? stats.currentStreak * 7 : stats.currentStreak;
}
