import { mapApiEquipment, mapApiUnit } from '@shared/data/api-mappers';
import type { Equipment, Operator, Unit } from '@shared/models/logistics.models';
import { resourceIdKey } from '@shared/utils/resource-id';

export function normalizeEquipmentFromApi(e: Equipment): Equipment {
  return mapApiEquipment(e as unknown as Record<string, unknown>);
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
