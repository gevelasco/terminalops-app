/** Trim y colapsa espacios múltiples (sin cambiar mayúsculas/minúsculas). */
export function normalizeCargoDescription(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
