import type { CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { Unit, UnitFleetMeta } from '@shared/models/logistics.models';

export type UnitPersistDraft = {
  unit?: Partial<Unit>;
  fleetMeta?: Partial<UnitFleetMeta>;
};

/** Une la unidad en pantalla con un borrador explícito (p. ej. formulario recién editado). */
export function mergeUnitForWrite(base: Unit, draft?: UnitPersistDraft): Unit {
  const unitPatch = draft?.unit ?? {};
  const metaPatch = draft?.fleetMeta ?? {};
  return {
    ...base,
    ...unitPatch,
    fleetMeta: { ...(base.fleetMeta ?? {}), ...metaPatch },
  };
}

/** Cuerpo de POST/PATCH de unidad (campos de `units` + `fleetMeta` completo). */
export function buildUnitWritePayload(unit: Unit, draft?: UnitPersistDraft): CreateUnitPayload {
  const merged = mergeUnitForWrite(unit, draft);
  return {
    plate: merged.plate.trim(),
    type: merged.type.trim(),
    capacityKg: merged.capacityKg,
    status: merged.status,
    serialNumber: merged.serialNumber?.trim() || undefined,
    name: merged.name?.trim() || undefined,
    trailerBrandAbbr: merged.trailerBrandAbbr?.trim() || undefined,
    trailerYear: merged.trailerYear?.trim() || undefined,
    fleetMeta: merged.fleetMeta,
  };
}
