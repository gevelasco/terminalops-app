import type { Unit } from '@shared/models/logistics.models';
import { buildUnitFleetOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

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
  const built = buildUnitFleetOperationalId({
    trailerBrandAbbr: u.trailerBrandAbbr,
    trailerYear: u.trailerYear,
    plate: u.plate,
  });
  if (built.startsWith('GEN-')) {
    return resourceIdKey(u.id);
  }
  return built;
}

/** Código operativo a partir del id y el catálogo de unidades cargado en memoria. */
export function labelForUnitId(
  unitId: string | number,
  units: readonly Unit[],
): string {
  const id = resourceIdKey(unitId);
  if (!id) {
    return 'Sin asignar';
  }
  const u = units.find((x) => resourceIdsEqual(x.id, id));
  return u ? formatUnitTrailerOperationalId(u) : id;
}
