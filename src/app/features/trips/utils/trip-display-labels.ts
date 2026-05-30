import type { Operator, Trip, Unit } from '@shared/models/logistics.models';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import { resourceIdKey } from '@shared/utils/resource-id';

/** Primera localidad antes de coma en «Ciudad, Estado». */
export function primaryLocalityFromCityMunicipality(
  line: string | null | undefined,
): string {
  const t = (line ?? '').trim();
  if (!t) {
    return '';
  }
  const comma = t.indexOf(',');
  return (comma >= 0 ? t.slice(0, comma) : t).trim();
}

/** Resumen de ruta para tablas: «Villa de Álvarez → Zapopan». */
export function formatTripRouteSummary(
  trip: Pick<
    Trip,
    'originCityMunicipality' | 'destinationCityMunicipality'
  >,
): string {
  const origin = primaryLocalityFromCityMunicipality(trip.originCityMunicipality);
  const destination = primaryLocalityFromCityMunicipality(
    trip.destinationCityMunicipality,
  );
  if (!origin && !destination) {
    return '—';
  }
  if (!origin) {
    return destination;
  }
  if (!destination) {
    return origin;
  }
  return `${origin} → ${destination}`;
}

export function tripOperatorDisplayName(
  trip: Pick<Trip, 'operatorNameSnapshot' | 'operatorName' | 'operatorId'>,
  operatorsById?: ReadonlyMap<string, string>,
): string {
  const snapshot = trip.operatorNameSnapshot?.trim() || trip.operatorName?.trim();
  if (snapshot) {
    return snapshot;
  }
  const id = resourceIdKey(trip.operatorId);
  if (id && operatorsById?.get(id)) {
    return operatorsById.get(id)!;
  }
  return 'Sin operador';
}

export function tripUnitDisplayCode(
  trip: Pick<Trip, 'unitOperationalCodeSnapshot' | 'unitOperationalCode' | 'unitId'>,
  units?: readonly Unit[],
): string {
  const snapshot =
    trip.unitOperationalCodeSnapshot?.trim() || trip.unitOperationalCode?.trim();
  if (snapshot) {
    return snapshot;
  }
  const id = resourceIdKey(trip.unitId);
  if (id && units?.length) {
    const label = labelForUnitId(id, units);
    if (label !== id && label !== 'Sin asignar') {
      return label;
    }
  }
  return id ? 'Sin unidad' : 'Sin unidad';
}

export function buildOperatorNameLookup(
  operators: readonly Operator[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const op of operators) {
    const id = resourceIdKey(op.id);
    const name = op.name?.trim();
    if (id && name) {
      map.set(id, name);
    }
  }
  return map;
}
