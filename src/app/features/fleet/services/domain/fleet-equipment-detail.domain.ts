import { Injectable } from '@angular/core';
import { fleetTenureMetaEquals } from '@features/fleet/utils/fleet-tenure-meta-equals';
import { isSubstantiveMaintenanceEntry } from '@features/fleet/utils/fleet-maintenance-entry.util';
import type { Equipment, EquipmentFleetMeta, MaintenanceEntry } from '@shared/models/logistics.models';
import type { EquipmentPersistDraft } from '@shared/utils/fleet/equipment-api-payload';

@Injectable({ providedIn: 'root' })
export class FleetEquipmentDetailDomain {
  hostEquipmentHasTenurePayload(meta: EquipmentFleetMeta | undefined): boolean {
    if (!meta) {
      return false;
    }
    return (
      meta.trailerTenureMode !== undefined ||
      meta.trailerCommercialValue !== undefined ||
      meta.trailerRecurringPaymentAmount !== undefined ||
      meta.trailerRecurringPaymentDate !== undefined ||
      meta.trailerRecurringInstallmentCount !== undefined ||
      meta.trailerRecurringPaymentCadence !== undefined ||
      meta.trailerTenureBeneficiary !== undefined ||
      meta.trailerManagementOwnerPayout !== undefined
    );
  }

  applyHostEquipmentSnapshotWhenRicher(current: Equipment, incoming: Equipment): Equipment | null {
    if (current.id !== incoming.id) {
      return null;
    }
    if (!this.hostEquipmentHasTenurePayload(incoming.fleetMeta)) {
      return null;
    }
    const mergedMeta = { ...(current.fleetMeta ?? {}), ...(incoming.fleetMeta ?? {}) };
    if (fleetTenureMetaEquals(current.fleetMeta, mergedMeta)) {
      return null;
    }
    return {
      ...current,
      ...incoming,
      fleetMeta: mergedMeta,
    };
  }

  equipmentForPersist(
    effEquipment: Equipment,
    localMaintEntries: MaintenanceEntry[],
    draft?: EquipmentPersistDraft,
  ): Equipment {
    const merged = draft
      ? {
          ...effEquipment,
          ...(draft.equipment ?? {}),
          fleetMeta: { ...(effEquipment.fleetMeta ?? {}), ...(draft.fleetMeta ?? {}) },
        }
      : effEquipment;
    if (localMaintEntries.length === 0) {
      return merged;
    }
    return {
      ...merged,
      fleetMeta: {
        ...(merged.fleetMeta ?? {}),
        maintenanceEntries: [
          ...localMaintEntries,
          ...(merged.fleetMeta?.maintenanceEntries ?? []).filter(
            isSubstantiveMaintenanceEntry,
          ),
        ],
      },
    };
  }
}
