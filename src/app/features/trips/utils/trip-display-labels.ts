import type { Equipment, Operator, Trip, Unit } from '@shared/models/logistics.models';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

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

/** Etiqueta de extremo de ruta desde partes postales (detalle). */
export function formatTripEndpointFromParts(
  trip: Pick<
    Trip,
    | 'originLocality'
    | 'originCityMunicipality'
    | 'originPostalCode'
    | 'destinationLocality'
    | 'destinationCityMunicipality'
    | 'destinationPostalCode'
  >,
  end: 'origin' | 'destination',
): string {
  const locality =
    end === 'origin'
      ? trip.originLocality?.trim()
      : trip.destinationLocality?.trim();
  const city =
    end === 'origin'
      ? trip.originCityMunicipality?.trim()
      : trip.destinationCityMunicipality?.trim();
  const cp =
    end === 'origin'
      ? trip.originPostalCode?.trim()
      : trip.destinationPostalCode?.trim();
  const parts = [locality, city].filter((p): p is string => Boolean(p && p.length > 0));
  if (parts.length > 0) {
    const base = parts.join(', ');
    return cp ? `${base} (CP ${cp})` : base;
  }
  return '—';
}

export function tripOperatorDisplayName(
  trip: Pick<Trip, 'operatorName' | 'operatorId'>,
  operatorsById?: ReadonlyMap<string, string>,
): string {
  const live = trip.operatorName?.trim();
  if (live) {
    return live;
  }
  const id = resourceIdKey(trip.operatorId);
  if (id && operatorsById?.get(id)) {
    return operatorsById.get(id)!;
  }
  return 'Sin operador';
}

export function tripUnitDisplayCode(
  trip: Pick<Trip, 'unitOperationalCode' | 'unitId'>,
  units?: readonly Unit[],
): string {
  const live = trip.unitOperationalCode?.trim();
  if (live) {
    return live;
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

/** Código operativo del equipo en la posición del convoy (0 = principal), p. ej. `MARCA-AÑO-PLACA`. */
export function tripEquipmentDisplayAt(
  trip: Pick<Trip, 'equipment' | 'equipmentIds'>,
  index: number,
  equipmentCatalog?: readonly Equipment[],
): string {
  const id = resourceIdKey(trip.equipmentIds?.[index]);
  if (id && equipmentCatalog?.length) {
    const eq = equipmentCatalog.find((e) => resourceIdsEqual(e.id, id));
    if (eq) {
      return formatEquipmentOperationalId(eq);
    }
  }
  const label = trip.equipment?.[index]?.trim();
  if (label) {
    return label;
  }
  return id || '—';
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
