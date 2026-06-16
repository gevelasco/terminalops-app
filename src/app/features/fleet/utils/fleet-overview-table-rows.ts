import type {
  FleetOverviewEquipmentRowDto,
  FleetOverviewItemDto,
} from '@shared/models/api/fleet-overview.model';
import {
  fleetOperationalKeyLabel,
  fleetOperationalPillClass,
} from '@features/fleet/utils/fleet-unit-table-row';
import {
  overviewOperationalKey,
  overviewUnitConvoyLabel,
  renewalBucketFromOverview,
} from '@features/fleet/utils/fleet-overview-view';

export function buildOverviewUnitTableRow(item: FleetOverviewItemDto): Record<string, unknown> {
  const operational = overviewOperationalKey(item.operationalStatus);
  const maint = item.maintenance;
  return {
    id: String(item.unitId),
    fleetBrand: item.unitName.split('-')[0] ?? '—',
    fleetModel: item.unitPlate || '—',
    fleetPlate: item.unitPlate || '—',
    fleetOperational: fleetOperationalKeyLabel(operational),
    fleetOperationalClass: fleetOperationalPillClass(operational),
    fleetMaint: renewalBucketFromOverview(maint?.maintenanceRenewal),
    fleetVerif: renewalBucketFromOverview(maint?.inspectionRenewal),
    fleetIns: renewalBucketFromOverview(maint?.insuranceRenewal),
    fleetConfig: overviewUnitConvoyLabel(item),
    fleetMaintNext: maint?.nextMaintenanceDate ?? '—',
    fleetVerifNext: maint?.inspectionStatus ?? '—',
    fleetInsNext: maint?.insuranceStatus ?? '—',
  };
}

export function buildOverviewEquipmentTableRow(
  row: FleetOverviewEquipmentRowDto,
): Record<string, unknown> {
  const operational = overviewOperationalKey(row.operationalStatus);
  const maint = row.maintenance;
  return {
    id: String(row.equipmentId),
    fleetBrand: row.brand,
    fleetModel: row.model,
    fleetUnitType: row.equipmentType,
    fleetPlate: row.plate,
    fleetOperational: fleetOperationalKeyLabel(operational),
    fleetOperationalClass: fleetOperationalPillClass(operational),
    fleetMaint: renewalBucketFromOverview(maint?.maintenanceRenewal),
    fleetVerif: renewalBucketFromOverview(maint?.inspectionRenewal),
    fleetIns: renewalBucketFromOverview(maint?.insuranceRenewal),
    fleetMaintNext: maint?.nextMaintenanceDate ?? '—',
    fleetVerifNext: maint?.inspectionStatus ?? '—',
    fleetInsNext: maint?.insuranceStatus ?? '—',
  };
}
