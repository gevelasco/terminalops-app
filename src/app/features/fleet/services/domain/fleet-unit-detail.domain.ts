import { fleetTenureMetaEquals } from '@features/fleet/utils/fleet-tenure-meta-equals';
import { isSubstantiveMaintenanceEntry } from '@features/fleet/utils/fleet-maintenance-entry.util';
import type {
  Equipment,
  MaintenanceEntry,
  Unit,
  UnitFleetMeta,
} from '@shared/models/logistics.models';
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

  /**
   * Mezcla fila de listado en el detalle del drawer: campos operativos del listado,
   * `fleetMeta` del detalle (evita pisar color/modalidad tras un PATCH con listado stale).
   */
  mergeUnitListRowIntoDetail(
    detail: Unit,
    listRow: Unit,
    hitchedEquipment?: Equipment[],
  ): Unit {
    const hitched =
      hitchedEquipment && hitchedEquipment.length > 0
        ? hitchedEquipment
        : listRow.hitchedEquipment ?? detail.hitchedEquipment;
    return {
      ...detail,
      ...listRow,
      fleetMeta: {
        ...(listRow.fleetMeta ?? {}),
        ...(detail.fleetMeta ?? {}),
      },
      hitchedEquipment: hitched,
    };
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
          ...(merged.fleetMeta?.maintenanceEntries ?? []).filter(
            isSubstantiveMaintenanceEntry,
          ),
        ],
      },
    };
  }
}
