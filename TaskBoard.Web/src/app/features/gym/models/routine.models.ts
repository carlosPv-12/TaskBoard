import { ExerciseType } from './exercise.models';

export interface RoutineExercise {
  exerciseId: number;
  exerciseName: string;
  exerciseType: ExerciseType;
  order: number;
}

export interface Routine {
  id: number;
  name: string;
  createdAt: string;
  exercises: RoutineExercise[];
}

export interface CreateRoutineRequest {
  name: string;
  exerciseIds: number[]; // el orden del array = orden en la rutina
}

/** Sustituye nombre y lista completa de ejercicios (los entrenos ya registrados no cambian). */
export type UpdateRoutineRequest = CreateRoutineRequest;
