export interface ExerciseProgressPoint {
  date: string; // "yyyy-MM-dd"
  maxWeight: number;
  totalVolume: number;
  // Solo en ejercicios de tiempo (null en los de fuerza)
  maxDurationSeconds: number | null;
  totalDurationSeconds: number | null;
  totalDistanceKm: number | null;
}
