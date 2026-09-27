export interface RoutineExercise {
  exerciseId: number;
  exerciseName: string;
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