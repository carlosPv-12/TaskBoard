import { Pipe, PipeTransform } from '@angular/core';

export type DurationFormat = 'clock' | 'short';

/**
 * Formatea segundos:
 *  - 'clock' → 01:02:05  (cronómetro)
 *  - 'short' → 1h 02m / 12m 05s / 45s  (totales)
 */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(totalSeconds: number | null | undefined, format: DurationFormat = 'clock'): string {
    const seconds = Math.max(0, Math.floor(totalSeconds ?? 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (format === 'short') {
      if (h > 0) return `${h}h ${pad(m)}m`;
      if (m > 0) return `${m}m ${pad(s)}s`;
      return `${s}s`;
    }
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
}