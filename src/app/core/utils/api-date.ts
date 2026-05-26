/** Normaliza fechas de la API (ISO string u objeto) para mostrarlas en UI. */
export function normalizeApiIsoDate(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { toISOString?: () => string };
    if (typeof maybe.toISOString === 'function') {
      return normalizeApiIsoDate(maybe.toISOString());
    }
  }
  return null;
}

export function isNumericPublicId(value: string | null | undefined): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}
