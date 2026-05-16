import type { Unit } from '@shared/models/logistics.models';
import { buildUnitFleetMockId } from './fleet-id-builders';

/** Etiqueta para selects: `Marca - Año - Placas`. */
export function formatUnitTrailerLabel(u: Unit): string {
  const brand =
    u.fleetMeta?.trailerBrandName?.trim() || u.trailerBrandAbbr?.trim() || '';
  const year = (u.trailerYear ?? '').trim();
  const plates = u.plate.trim();
  return `${brand} - ${year} - ${plates}`;
}

/**
 * Id operativo visible: abreviatura-año-placas (ej. `HYU-2021-81-AA-9K`).
 * Si faltan datos, se usa el `id` interno.
 */
export function formatUnitTrailerOperationalId(u: Unit): string {
  const built = buildUnitFleetMockId({
    trailerBrandAbbr: u.trailerBrandAbbr,
    trailerYear: u.trailerYear,
    plate: u.plate,
  });
  if (built.startsWith('GEN-')) {
    return u.id.trim();
  }
  return built;
}

/** Código operativo a partir del id y el catálogo de unidades cargado en memoria. */
export function labelForUnitId(unitId: string, units: readonly Unit[]): string {
  const id = unitId?.trim();
  if (!id) {
    return 'Sin asignar';
  }
  const u = units.find((x) => x.id === id);
  return u ? formatUnitTrailerOperationalId(u) : id;
}
