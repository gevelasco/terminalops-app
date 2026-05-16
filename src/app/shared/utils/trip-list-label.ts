import type { Trip } from '@shared/models/logistics.models';

/** Etiqueta compacta para listas y autocompletado de maniobras. */
export function formatTripListLabel(t: Trip): string {
  const code = (t.maneuverCode ?? t.id).trim();
  return `${code} · ${t.origin} → ${t.destination}`;
}
