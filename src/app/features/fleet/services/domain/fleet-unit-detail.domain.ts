import { fleetTenureMetaEquals } from '@features/fleet/utils/fleet-tenure-meta-equals';
import type { MaintenanceEntry, Unit, UnitFleetMeta } from '@shared/models/logistics.models';
import type { UnitPersistDraft } from '@shared/utils/fleet/unit-api-payload';

import { Injectable } from '@angular/core';

/** Lógica pura del detalle de unidad (sin signals). */
@Injectable({ providedIn: 'root' })
export class FleetUnitDetailDomain {
  hostUnitHasTenurePayload(meta: UnitFleetMeta | undefined): boolean {
    if (!meta) {
      return false;
    }
    return (
      meta.trailerTenureMode !== undefined ||
      meta.trailerCommercialValue !== undefined ||
      meta.trailerRecurringPaymentAmount !== undefined ||
      meta.trailerRecurringPaymentDate !== undefined ||
      meta.trailerRecurringInstallmentCount !== undefined ||
      meta.trailerManagementOwnerPayout !== undefined
    );
  }

  applyHostUnitSnapshotWhenRicher(current: Unit, incoming: Unit): Unit | null {
    if (current.id !== incoming.id) {
      return null;
    }
    if (!this.hostUnitHasTenurePayload(incoming.fleetMeta)) {
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

  unitForPersist(
    effUnit: Unit,
    localMaintEntries: MaintenanceEntry[],
    draft?: UnitPersistDraft,
  ): Unit {
    const merged = draft
      ? {
          ...effUnit,
          ...(draft.unit ?? {}),
          fleetMeta: { ...(effUnit.fleetMeta ?? {}), ...(draft.fleetMeta ?? {}) },
        }
      : effUnit;
    if (localMaintEntries.length === 0) {
      return merged;
    }
    return {
      ...merged,
      fleetMeta: {
        ...(merged.fleetMeta ?? {}),
        maintenanceEntries: [
          ...localMaintEntries,
          ...(merged.fleetMeta?.maintenanceEntries ?? []),
        ],
      },
    };
  }
}
