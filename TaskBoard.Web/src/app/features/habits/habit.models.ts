export type HabitFrequency = 'Daily' | 'Weekly';

export interface Habit {
  id: number;
  name: string;
  frequency: HabitFrequency;
  createdAt: string;
}

export interface CreateHabitRequest {
  name: string;
  frequency: HabitFrequency;
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

export interface HabitStats {
  habitName: string;
  totalLogs: number;
  completedLogs: number;
  completionRate: number;
  currentStreak: number;
}

/** Posición en el ranking de constancia (para los distintivos). */
export type HabitRank = 'best' | 'worst' | null;

export const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  Daily: 'Diario',
  Weekly: 'Semanal'
};