import { TimeEntry } from './task.models';

/** Entrada en marcha (sin stoppedAt), o null si el cronómetro está parado. */
export function activeEntryOf(entries: readonly TimeEntry[]): TimeEntry | null {
  return entries.find(entry => entry.stoppedAt === null) ?? null;
}

/** Segundos transcurridos desde que arrancó una entrada hasta "now" (ms). */
export function elapsedSeconds(entry: TimeEntry, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(entry.startedAt)) / 1000));
}

/** Tiempo total: entradas cerradas (duración del backend) + la activa en vivo. */
export function totalSecondsOf(entries: readonly TimeEntry[], now: number): number {
  return entries.reduce(
    (sum, entry) =>
      sum + (entry.stoppedAt === null ? elapsedSeconds(entry, now) : entry.durationSeconds ?? 0),
    0
  );
}