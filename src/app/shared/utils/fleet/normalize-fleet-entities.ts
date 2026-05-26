import { mapApiUnit } from '@shared/data/api-mappers';
import type { Equipment, Operator, Unit } from '@shared/models/logistics.models';
import { resourceIdKey } from '@shared/utils/resource-id';

export function normalizeEquipmentFromApi(e: Equipment): Equipment {
  const unitIdKey = resourceIdKey(e.unitId);
  return {
    ...e,
    id: resourceIdKey(e.id),
    unitId: unitIdKey,
  };
}

export function normalizeUnitFromApi(u: Unit): Unit {
  return mapApiUnit(u as unknown as Record<string, unknown>);
}

export function normalizeOperatorFromApi(o: Operator): Operator {
  return {
    ...o,
    id: resourceIdKey(o.id),
  };
}
