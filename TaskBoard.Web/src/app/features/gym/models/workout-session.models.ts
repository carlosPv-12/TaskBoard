export interface WorkoutSet {
  id: number;
  setNumber: number;
  weight: number; // decimal de C# → number (p. ej. 82.5)
  reps: number;
}

export interface SessionExercise {
  id: number;
  exerciseId: number;
  exerciseName: string;
  order: number;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: number;
  date: string; // DateOnly → "yyyy-MM-dd"
  routineId: number | null;
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
  weight: number;
  reps: number;
}