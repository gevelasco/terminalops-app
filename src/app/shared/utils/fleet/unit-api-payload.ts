import type { CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { Unit, UnitFleetMeta } from '@shared/models/logistics.models';
import { trailerTenureModeOrDefault } from '@shared/utils/fleet/trailer-tenure-mode';

function fleetMetaWithTenureDefault(meta: UnitFleetMeta | undefined): UnitFleetMeta | undefined {
  if (!meta) {
    return undefined;
  }
  return {
    ...meta,
    trailerTenureMode: trailerTenureModeOrDefault(meta.trailerTenureMode),
  };
}

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

/** Cuerpo de POST/PATCH de unidad (campos de `units` + `fleetMeta`). */
export function buildUnitWritePayload(unit: Unit, draft?: UnitPersistDraft): CreateUnitPayload {
  const merged = mergeUnitForWrite(unit, draft);
  const fleetMeta =
    draft?.fleetMeta !== undefined
      ? fleetMetaWithTenureDefault(draft.fleetMeta as UnitFleetMeta)
      : fleetMetaWithTenureDefault(merged.fleetMeta);

  return {
    plate: merged.plate.trim(),
    capacityKg: merged.capacityKg,
    status: merged.status,
    serialNumber: merged.serialNumber?.trim() || undefined,
    name: merged.name?.trim() || undefined,
    trailerBrandAbbr: merged.trailerBrandAbbr?.trim() || undefined,
    trailerYear: merged.trailerYear?.trim() || undefined,
    fleetMeta,
  };
}
