/** Fuerza = peso × repeticiones. Tiempo = duración (+ distancia y peso opcionales). */
export type ExerciseType = 'Strength' | 'Time';

export interface Exercise {
  id: number;
  name: string;
  muscleGroup: string;
  type: ExerciseType;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroup: string;
  type: ExerciseType;
}

export type UpdateExerciseRequest = CreateExerciseRequest;

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  Strength: 'Fuerza',
  Time: 'Tiempo'
};

/** El backend acepta cualquier texto; en el front ofrecemos una lista cerrada para no tener "Pecho", "pecho" y "Pectoral". */
export const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Glúteos',
  'Hombros',
  'Bíceps',
  'Tríceps',
  'Core',
  'Cardio',
  'Cuerpo completo'
] as const;
