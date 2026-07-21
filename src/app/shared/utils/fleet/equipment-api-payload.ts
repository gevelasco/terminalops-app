import type { CreateEquipmentPayload } from '@shared/models/api/api-fleet.model';
import type { Equipment, EquipmentFleetMeta } from '@shared/models/logistics.models';
import { withoutFleetOperationalStatus } from '@shared/utils/fleet/fleet-write-payload-sanitize';
import { trailerTenureModeOrDefault } from '@shared/utils/fleet/trailer-tenure-mode';

function fleetMetaWithTenureDefault(
  meta: EquipmentFleetMeta | undefined,
): EquipmentFleetMeta | undefined {
  if (!meta) {
    return undefined;
  }
  return {
    ...meta,
    trailerTenureMode: trailerTenureModeOrDefault(meta.trailerTenureMode),
  };
}

export type EquipmentPersistDraft = {
  equipment?: Partial<Equipment>;
  fleetMeta?: Partial<EquipmentFleetMeta>;
  /** Envía solo las claves de `fleetMeta` del borrador (p. ej. confirmar un pago). */
  sparseFleetMeta?: boolean;
};

/** `null` en PATCH = desenganchar de la tractora. */
export function unitIdForEquipmentPayload(
  raw: string | null | undefined,
): string | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** Une el equipo en pantalla con un borrador explícito (p. ej. formulario recién editado). */
export function mergeEquipmentForWrite(
  base: Equipment,
  draft?: EquipmentPersistDraft,
): Equipment {
  const equipmentPatch = draft?.equipment ?? {};
  const metaPatch = draft?.fleetMeta ?? {};
  return {
    ...base,
    ...equipmentPatch,
    fleetMeta: { ...(base.fleetMeta ?? {}), ...metaPatch },
  };
}

/** Cuerpo de POST/PATCH de equipo (campos de `equipment` + `fleetMeta`). */
export function buildEquipmentWritePayload(
  equipment: Equipment,
  draft?: EquipmentPersistDraft,
): CreateEquipmentPayload {
  const merged = mergeEquipmentForWrite(equipment, draft?.sparseFleetMeta ? undefined : draft);
  const fleetMeta = draft?.sparseFleetMeta
    ? fleetMetaWithTenureDefault(draft.fleetMeta as EquipmentFleetMeta | undefined)
    : fleetMetaWithTenureDefault(merged.fleetMeta);
  const name = (merged.name || merged.serialNumber).trim();
  const unitId = unitIdForEquipmentPayload(merged.unitId);
  const hitchPosition = unitId
    ? merged.hitchPosition === 'rear'
      ? 'rear'
      : 'lead'
    : null;

  return withoutFleetOperationalStatus({
    unitId,
    hitchPosition,
    name,
    serialNumber: merged.serialNumber.trim(),
    plate: merged.plate?.trim() || undefined,
    type: merged.type?.trim() || undefined,
    isActive: merged.isActive !== false,
    trailerBrandAbbr: merged.trailerBrandAbbr?.trim() || undefined,
    trailerYear: merged.trailerYear?.trim() || undefined,
    fleetMeta,
  }) as CreateEquipmentPayload;
}
