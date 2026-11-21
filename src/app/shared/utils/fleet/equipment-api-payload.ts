import type { CreateEquipmentPayload } from '@shared/models/api/api-fleet.model';
import type { Equipment, EquipmentFleetMeta } from '@shared/models/logistics.models';
import { isDollyEquipmentType } from '@features/fleet/utils/equipment-dolly-convoy.util';
import { mapAppHitchPositionToApiWrite } from '@shared/utils/fleet/equipment-hitch-position-api.util';
import {
  sanitizeFleetMetaForWrite,
  withoutFleetOperationalStatus,
} from '@shared/utils/fleet/fleet-write-payload-sanitize';
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

/** Sparse: no inyecta `trailerTenureMode` si el borrador no lo toca. */
function sparseEquipmentFleetMeta(
  meta: Partial<EquipmentFleetMeta> | undefined,
): EquipmentFleetMeta | undefined {
  if (!meta) {
    return undefined;
  }
  if (meta.trailerTenureMode !== undefined) {
    return fleetMetaWithTenureDefault(meta as EquipmentFleetMeta);
  }
  return meta as EquipmentFleetMeta;
}

export type EquipmentPersistDraft = {
  equipment?: Partial<Equipment>;
  fleetMeta?: Partial<EquipmentFleetMeta>;
  /** Envía solo las claves de `fleetMeta` del borrador (p. ej. confirmar un pago). */
  sparseFleetMeta?: boolean;
  /** Otros equipos en la misma tractora (serialización hitch API). */
  hitchPeersOnUnit?: readonly Equipment[];
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
  const equipmentPatch = draft?.equipment ?? {};
  const merged = {
    ...equipment,
    ...equipmentPatch,
  };
  const fleetMeta = draft?.sparseFleetMeta
    ? sparseEquipmentFleetMeta(draft.fleetMeta)
    : fleetMetaWithTenureDefault(
        draft?.fleetMeta
          ? { ...(equipment.fleetMeta ?? {}), ...draft.fleetMeta }
          : merged.fleetMeta,
      );
  const name = (merged.name || merged.serialNumber).trim();
  const unitId = unitIdForEquipmentPayload(merged.unitId);
  let hitchPosition: CreateEquipmentPayload['hitchPosition'];
  if (unitId) {
    const mapped = mapAppHitchPositionToApiWrite(merged.hitchPosition, merged.type, {
      peersOnUnit: draft?.hitchPeersOnUnit,
      equipmentId: merged.id,
    });
    if (merged.hitchPosition === 'rear' && !isDollyEquipmentType(merged.type)) {
      hitchPosition = 'rear';
    } else if (merged.hitchPosition === 'lead') {
      hitchPosition = 'lead';
    } else if (mapped === 'lead' || mapped === 'rear') {
      hitchPosition = mapped;
    }
    // Dolly intermedio u otros sin slot API válido: no enviar hitchPosition en el PATCH.
  } else {
    hitchPosition = null;
  }

  const core = withoutFleetOperationalStatus({
    unitId,
    name,
    serialNumber: merged.serialNumber.trim(),
    plate: merged.plate?.trim() || undefined,
    type: merged.type?.trim() || undefined,
    isActive: merged.isActive !== false,
    trailerBrandAbbr: merged.trailerBrandAbbr?.trim() || undefined,
    trailerYear: merged.trailerYear?.trim() || undefined,
    fleetMeta: sanitizeFleetMetaForWrite(
      fleetMeta as Record<string, unknown> | undefined,
    ) as EquipmentFleetMeta | undefined,
  }) as CreateEquipmentPayload;
  if (hitchPosition !== undefined) {
    core.hitchPosition = hitchPosition;
  }
  return core;
}
