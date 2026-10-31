import { ExerciseType } from './exercise.models';

/**
 * Una serie. Fuerza: weight + reps. Tiempo: durationSeconds (+ distanceKm y weight opcionales).
 * Los campos que no aplican llegan a null.
 */
export interface WorkoutSet {
  id: number;
  setNumber: number;
  weight: number | null; // decimal de C# → number (p. ej. 82.5)
  reps: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

export interface SessionExercise {
  id: number;
  exerciseId: number;
  exerciseName: string;
  exerciseType: ExerciseType;
  order: number;
  sets: WorkoutSet[];
}

export interface SessionRoutine {
  id: number;
  name: string;
}

export interface WorkoutSession {
  id: number;
  date: string; // DateOnly → "yyyy-MM-dd"
  routines: SessionRoutine[];
  routineId: number | null;
  /** Nombres unidos ("Pecho + Abdominales"); null en un entreno libre. */
  routineName: string | null;
  durationMinutes: number | null;
  exercises: SessionExercise[]; // vacío en el GET de lista (calendario)
}

export interface CreateWorkoutSessionRequest {
  date: string;
  routineId?: number | null;
  durationMinutes?: number | null;
}

export interface UpdateWorkoutSessionRequest {
  durationMinutes: number | null;
}

export interface AddSessionExerciseRequest {
  exerciseId: number;
}

export interface CreateWorkoutSetRequest {
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceKm?: number | null;
}
