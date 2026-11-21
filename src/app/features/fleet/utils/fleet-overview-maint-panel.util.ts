import {
  fleetComplianceIconsForEquipment,
  fleetComplianceIconsForUnit,
  type FleetComplianceIconView,
} from '@features/fleet/utils/fleet-compliance-icons.util';
import { fleetOverviewLastMaintenanceLabel } from '@features/fleet/utils/fleet-overview-card';
import { formatMaintenanceKmCounterLabel } from '@features/fleet/utils/fleet-maintenance-km.util';
import { fleetTireConditionDisplayLabel } from '@features/fleet/utils/fleet-tire-condition.util';
import { FLEET_TIRE_CONDITION_OPTIONS } from '@shared/catalogs/fleet-form-options';
import {
  fleetMaintenanceKmRemaining,
  fleetMaintenanceRenewal,
  formatFleetYmdMx,
  nextMaintenanceTableDate,
  type FleetComplianceSummary,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';
import type { EquipmentFleetMeta, UnitFleetMeta } from '@shared/models/logistics.models';
import type {
  FleetOverviewMaintenanceDto,
  FleetOverviewRenewalStatus,
} from '@shared/models/api/fleet-overview.model';
import type { CompanyMaintenancePolicy } from '@shared/models/company-operational-settings.models';
import type { Equipment, Unit } from '@shared/models/logistics.models';
import type { FleetOverviewCardEntry } from '@features/fleet/utils/fleet-overview-view';

export type FleetOverviewComplianceBlockView = {
  title: string;
  bucket: FleetRenewalBucket;
  statusLabel: string;
  primaryDetail: string;
  secondaryDetail: string | null;
};

export type FleetOverviewMaintPanelView = {
  lastMaintenanceLabel: string;
  secondaryMaint: { label: string; bucket: FleetRenewalBucket } | null;
  showKmCounter: boolean;
  kmCounterLabel: string | null;
  tireConditionLabel: string;
  complianceBlocks: FleetOverviewComplianceBlockView[];
  complianceIcons: FleetComplianceIconView[];
};

export function fleetRenewalBadgeClass(bucket: FleetRenewalBucket): string {
  const mod =
    bucket === 'due'
      ? 'due'
      : bucket === 'soon'
        ? 'soon'
        : bucket === 'ok'
          ? 'ok'
          : 'na';
  return `fleet-unit-detail__badge fleet-unit-detail__badge--${mod}`;
}

function formatKmRemainingLabel(
  meta: UnitFleetMeta | undefined,
  policy?: CompanyMaintenancePolicy,
): string | null {
  const raw = fleetMaintenanceKmRemaining(meta, policy);
  if (raw == null || !Number.isFinite(raw)) {
    return null;
  }
  const formatted = new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 0,
  }).format(Math.max(0, raw));
  return `Kms restantes: ${formatted} km`;
}

function insuranceSecondaryDetail(
  meta: UnitFleetMeta | EquipmentFleetMeta | undefined,
): string | null {
  const carrier = meta?.insuranceCarrierName?.trim();
  if (carrier) {
    return carrier;
  }
  const policy = meta?.insurancePolicyNumber?.trim();
  if (policy) {
    return `Póliza ${policy}`;
  }
  return null;
}

function buildComplianceBlocks(
  summary: FleetComplianceSummary | undefined,
  meta: UnitFleetMeta | EquipmentFleetMeta | undefined,
): FleetOverviewComplianceBlockView[] {
  if (!summary) {
    return [];
  }
  const blocks: FleetOverviewComplianceBlockView[] = [];

  if (summary.insBucket !== 'na') {
    const next = summary.insNext?.trim();
    const contract = formatFleetYmdMx(meta?.insuranceContractDate);
    const primaryDetail =
      next && next !== '—'
        ? `Próx. pago: ${next}`
        : contract !== '—'
          ? `Contrato: ${contract}`
          : 'Sin fecha de pago registrada';
    blocks.push({
      title: 'Seguro',
      bucket: summary.insBucket,
      statusLabel: summary.insLabel,
      primaryDetail,
      secondaryDetail: insuranceSecondaryDetail(meta),
    });
  }

  if (summary.verifBucket !== 'na') {
    const next = summary.verifNext?.trim();
    const primaryDetail =
      next && next !== '—' ? `Próximo vencimiento: ${next}` : 'Sin fecha de verificación';
    blocks.push({
      title: 'Verificaciones',
      bucket: summary.verifBucket,
      statusLabel: summary.verifLabel,
      primaryDetail,
      secondaryDetail: null,
    });
  }

  return blocks;
}

function complianceIconsFromSummary(
  summary: FleetComplianceSummary | undefined,
): FleetComplianceIconView[] {
  if (!summary) {
    return [];
  }
  const items: FleetComplianceIconView[] = [];
  if (summary.verifBucket !== 'na') {
    items.push({
      kind: 'verification',
      bucket: summary.verifBucket,
      tooltip: `Verificación: ${summary.verifLabel}.`,
    });
  }
  if (summary.insBucket !== 'na') {
    items.push({
      kind: 'insurance',
      bucket: summary.insBucket,
      tooltip: `Seguro: ${summary.insLabel}.`,
    });
  }
  return items;
}

export function buildOverviewMaintPanelFromUnit(
  unit: Unit,
  policy?: CompanyMaintenancePolicy,
  compliance?: FleetComplianceSummary,
): FleetOverviewMaintPanelView {
  const meta = unit.fleetMeta;
  let secondaryMaint: FleetOverviewMaintPanelView['secondaryMaint'] = null;

  if (policy?.kmControlEnabled) {
    const label = formatKmRemainingLabel(meta, policy);
    if (label) {
      secondaryMaint = {
        label,
        bucket: fleetMaintenanceRenewal(meta, policy),
      };
    }
  } else if (policy?.dateControlEnabled) {
    const next = nextMaintenanceTableDate(meta, policy);
    if (next) {
      secondaryMaint = {
        label: `Próx.: ${next}`,
        bucket: fleetMaintenanceRenewal(meta, policy),
      };
    }
  }

  return {
    lastMaintenanceLabel: fleetOverviewLastMaintenanceLabel(unit),
    secondaryMaint,
    showKmCounter: policy?.kmControlEnabled === true,
    kmCounterLabel: policy?.kmControlEnabled
      ? formatMaintenanceKmCounterLabel(meta)
      : null,
    tireConditionLabel: fleetTireConditionDisplayLabel(
      meta?.tireCondition,
      FLEET_TIRE_CONDITION_OPTIONS,
    ),
    complianceBlocks: buildComplianceBlocks(compliance, meta),
    complianceIcons: fleetComplianceIconsForUnit(unit),
  };
}

export function buildOverviewMaintPanelFromEquipment(
  equipment: Equipment,
  compliance?: FleetComplianceSummary,
): FleetOverviewMaintPanelView {
  const meta = equipment.fleetMeta;
  const lastIso = meta?.lastMaintenanceDate?.trim();
  let lastMaintenanceLabel = '—';
  if (lastIso) {
    const d = new Date(`${lastIso}T12:00:00`);
    lastMaintenanceLabel = Number.isNaN(d.getTime())
      ? lastIso
      : new Intl.DateTimeFormat('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(d);
  }

  return {
    lastMaintenanceLabel,
    secondaryMaint: null,
    showKmCounter: false,
    kmCounterLabel: null,
    tireConditionLabel: fleetTireConditionDisplayLabel(
      meta?.tireCondition,
      FLEET_TIRE_CONDITION_OPTIONS,
    ),
    complianceBlocks: buildComplianceBlocks(compliance, meta),
    complianceIcons: fleetComplianceIconsForEquipment(equipment),
  };
}

export function buildOverviewMaintPanelFallback(
  entry: FleetOverviewCardEntry,
): FleetOverviewMaintPanelView | undefined {
  const maintenance = entry.maintenance;
  if (!maintenance) {
    return undefined;
  }
  const secondaryFromDto = secondaryMaintFromOverviewDto(maintenance);
  return {
    lastMaintenanceLabel: maintenance.lastMaintenanceDate?.trim() || '—',
    secondaryMaint: secondaryFromDto,
    showKmCounter: false,
    kmCounterLabel: null,
    tireConditionLabel: maintenance.tireStatus?.trim() || '—',
    complianceBlocks: buildComplianceBlocks(entry.compliance, undefined),
    complianceIcons: complianceIconsFromSummary(entry.compliance),
  };
}

function renewalFromOverviewStatus(
  status: FleetOverviewRenewalStatus | undefined,
): FleetRenewalBucket {
  if (status === 'ok' || status === 'soon' || status === 'due') {
    return status;
  }
  return 'na';
}

function secondaryMaintFromOverviewDto(
  maintenance: FleetOverviewMaintenanceDto,
): FleetOverviewMaintPanelView['secondaryMaint'] {
  const km = maintenance.kmSinceLastMaintenance;
  if (km != null && Number.isFinite(km) && maintenance.nextMaintenanceDate == null) {
    const bucket = renewalFromOverviewStatus(maintenance.maintenanceRenewal);
    const formatted = new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 0,
    }).format(Math.round(km));
    return {
      label: `Kms restantes: ${formatted} km`,
      bucket,
    };
  }
  const next = maintenance.nextMaintenanceDate?.trim();
  if (next) {
    return {
      label: `Próx.: ${next}`,
      bucket: renewalFromOverviewStatus(maintenance.maintenanceRenewal),
    };
  }
  return null;
}