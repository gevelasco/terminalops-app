import type { Trip } from '@shared/models/logistics.models';
import { formatTripRouteSummary } from '@features/trips/utils/trip-display-labels';

/** Etiqueta compacta para listas y autocompletado de maniobras. */
export function formatTripListLabel(t: Trip): string {
  const code = (t.maneuverCode ?? t.id).trim();
  const route = formatTripRouteSummary(t);
  return route === '—' ? code : `${code} · ${route}`;
}
