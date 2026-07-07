/** Parsea km almacenados como string en perfil de flota (odómetro, restantes, etc.). */
export function parseFleetStoredKm(
  raw: string | number | null | undefined,
): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Etiqueta es-MX para odómetro / km acumulados persistidos. */
export function formatFleetStoredKmLabel(
  raw: string | number | null | undefined,
): string {
  const n = parseFleetStoredKm(raw);
  if (n == null) {
    return '—';
  }
  return `${new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(n)} km`;
}
