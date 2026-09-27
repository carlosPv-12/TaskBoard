/**
 * Minúsculas y sin tildes, para búsquedas tolerantes: "Bíceps" → "biceps".
 * NFD separa cada letra de su tilde ("í" → "i" + "´") y la regex elimina las tildes.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}