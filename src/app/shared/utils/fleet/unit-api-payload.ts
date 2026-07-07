import type { CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { Unit, UnitFleetMeta } from '@shared/models/logistics.models';
import { withoutFleetOperationalStatus } from '@shared/utils/fleet/fleet-write-payload-sanitize';
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
  /** Envía solo las claves de `fleetMeta` del borrador (p. ej. confirmar un pago). */
  sparseFleetMeta?: boolean;
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
  const unitPatch = draft?.unit ?? {};
  const mergedUnit = {
    ...unit,
    ...unitPatch,
  };
  const fleetMeta = draft?.sparseFleetMeta
    ? fleetMetaWithTenureDefault(draft.fleetMeta as UnitFleetMeta | undefined)
    : fleetMetaWithTenureDefault(
        draft?.fleetMeta
          ? { ...(unit.fleetMeta ?? {}), ...draft.fleetMeta }
          : mergedUnit.fleetMeta,
      );

  return withoutFleetOperationalStatus({
    plate: mergedUnit.plate.trim(),
    capacityKg: mergedUnit.capacityKg,
    isActive: mergedUnit.isActive !== false,
    serialNumber: mergedUnit.serialNumber?.trim() || undefined,
    motorNumber: mergedUnit.motorNumber?.trim() || undefined,
    capacityTons:
      mergedUnit.capacityTons != null && Number.isFinite(mergedUnit.capacityTons)
        ? mergedUnit.capacityTons
        : undefined,
    name: mergedUnit.name?.trim() || undefined,
    trailerBrandAbbr: mergedUnit.trailerBrandAbbr?.trim() || undefined,
    trailerYear: mergedUnit.trailerYear?.trim() || undefined,
    fleetMeta,
  }) as CreateUnitPayload;
}
