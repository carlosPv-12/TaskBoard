/**
 * Utilidades para fechas SIN hora ("yyyy-MM-dd"), equivalentes a LocalDate en Java.
 * Todo se calcula con componentes LOCALES: nunca toISOString() (que convierte a UTC).
 * Como "yyyy-MM-dd" ordena igual alfabética que cronológicamente, se puede comparar con < y >.
 */

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2026-09-26" → Date a las 00:00 hora LOCAL (new Date("2026-09-26") sería UTC). */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(iso: string): string {
  const date = parseIsoDate(iso);
  const daysSinceMonday = (date.getDay() + 6) % 7; // getDay(): 0 = domingo
  date.setDate(date.getDate() - daysSinceMonday);
  return toIsoDate(date);
}

/** Día 1 del mes que contiene la fecha. */
export function startOfMonth(iso: string): string {
  const date = parseIsoDate(iso);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

/** Día 1 del mes desplazado N meses (negativo = hacia atrás). */
export function shiftMonth(iso: string, months: number): string {
  const date = parseIsoDate(iso);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + months, 1));
}