import type { Trip } from '@shared/models/logistics.models';

/** Cuenta maniobras cuyo `clientId` coincide con el id del catálogo. */
export function tripCountByClientId(
  trips: readonly Trip[],
  clientId: string,
): number {
  const id = clientId.trim();
  if (!id) {
    return 0;
  }
  return trips.filter((t) => (t.clientId ?? '').trim() === id).length;
}

/** Cuenta maniobras cuyo `clientName` coincide con el nombre del catálogo (texto en viaje). */
export function tripCountByClientName(
  trips: readonly Trip[],
  clientName: string,
): number {
  const n = clientName.trim().toLowerCase();
  if (!n) {
    return 0;
  }
  return trips.filter(
    (t) => (t.clientName ?? '').trim().toLowerCase() === n,
  ).length;
}
