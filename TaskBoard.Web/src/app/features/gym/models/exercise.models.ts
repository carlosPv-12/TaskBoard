export interface Exercise {
  id: number;
  name: string;
  muscleGroup: string;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroup: string;
}

export type UpdateExerciseRequest = CreateExerciseRequest;

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