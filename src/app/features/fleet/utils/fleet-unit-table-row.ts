import type { Expense } from '@shared/models/logistics.models';
import { EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import { fleetBrandDisplayName } from '@shared/utils/fleet/fleet-brand-display';
import type { CompanyMaintenancePolicy } from '@shared/models/company-operational-settings.models';
import {
  Equipment,
  EquipmentFleetMeta,
  Unit,
  UnitFleetMeta,
} from '@shared/models/logistics.models';
import { resolveUnitOperationalKey } from '@shared/utils/fleet/fleet-status.resolver';
import {
  effectiveFleetMetaForMaintenance,
  resolveMaintenanceContext,
} from '@shared/utils/fleet/company-maintenance-policy';
import { fleetMaintenanceKmRemainingFromCounter } from '@features/fleet/utils/fleet-maintenance-km.util';
import { fleetUnitConvoyTableBadges } from '@app/features/fleet/utils/unit-hitched-equipment';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import {
  cadenceToMonths,
  insurancePaymentAnchor,
  nextInsurancePaymentDate as nextInsurancePaymentDateFromUtil,
} from '@features/fleet/utils/fleet-insurance-payment.util';
import { nextGpsPaymentDate as nextGpsPaymentDateFromUtil } from '@features/fleet/utils/fleet-gps-payment.util';
import { insurancePaymentCompliance } from '@features/fleet/utils/fleet-insurance-schedule.util';
import { gpsPaymentCompliance } from '@features/fleet/utils/fleet-gps-schedule.util';

export type FleetRenewalBucket = 'ok' | 'soon' | 'due' | 'na';

/** Ventana «próximo» para seguro y verificaciones (misma regla que el drawer). */
export const FLEET_COMPLIANCE_SOON_DAYS = 10;

export type FleetComplianceSummary = {
  verifBucket: FleetRenewalBucket;
  insBucket: FleetRenewalBucket;
  verifLabel: string;
  insLabel: string;
  verifNext: string;
  insNext: string;
};

export function fleetRenewalBucketLabel(bucket: FleetRenewalBucket): string {
  switch (bucket) {
    case 'ok':
      return 'Al día';
    case 'soon':
      return 'Próximo';
    case 'due':
      return 'Vencido';
    default:
      return '—';
  }
}

/** Metadatos mínimos para ciclo de seguro (unidad o equipo). */
export type FleetInsuranceRenewalMeta = Pick<
  UnitFleetMeta,
  | 'insurancePolicyNumber'
  | 'insuranceCarrierName'
  | 'insuranceContractDate'
  | 'insuranceLastPaymentDate'
  | 'insurancePaymentCadence'
  | 'insuranceCost'
>;

/** Metadatos mínimos para próximo mantenimiento sugerido (unidad o equipo). */
export type FleetLastMaintenanceMeta = Pick<
  UnitFleetMeta,
  'lastMaintenanceDate' | 'maintenanceNextDateOverride'
>;

export type FleetOperationalKey =
  | 'on_route'
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'scheduled'
  | 'unknown';

/** Misma leyenda que la columna «Estado operativo» en `to-table` (Flota). */
export function fleetOperationalKeyLabel(key: FleetOperationalKey): string {
  switch (key) {
    case 'on_route':
      return tripStatusUiLabel('in_transit');
    case 'available':
      return 'Disponible';
    case 'in_use':
      return tripStatusUiLabel('in_transit');
    case 'maintenance':
      return 'Mantenimiento';
    case 'scheduled':
      return 'Programado';
    default:
      return '—';
  }
}

export function fleetOperationalPillClass(key: FleetOperationalKey): string {
  const base = 'to-table-pill';
  switch (key) {
    case 'on_route':
      return `${base} to-table-pill--fleet-maneuver`;
    case 'available':
      return `${base} to-table-pill--fleet-available`;
    case 'in_use':
      return `${base} to-table-pill--fleet-maneuver`;
    case 'maintenance':
      return `${base} to-table-pill--fleet-maintenance`;
    case 'scheduled':
      return `${base} to-table-pill--fleet-scheduled`;
    default:
      return `${base} to-table-pill--fleet-unknown`;
  }
}

function parseYmd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(t + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function addYears(base: Date, years: number): Date {
  const d = new Date(base.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysFromToday(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target.getTime());
  t.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - today.getTime()) / 86400000);
}

function fmtMx(d: Date): string {
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function lineRenewal(
  label: string,
  iso: string | undefined,
  cycleMonths: number,
): string {
  const raw = iso?.trim();
  if (!raw) {
    return `${label}: sin fecha.`;
  }
  const start = parseYmd(raw);
  if (!start) {
    return `${label}: fecha no válida (${raw}).`;
  }
  const next = addMonths(start, cycleMonths);
  const d = daysFromToday(next);
  const nextFmt = fmtMx(next);
  if (d < 0) {
    return `Próxima: ${nextFmt}. ${label}: vencida (hace ${-d} días). Última: ${raw}.`;
  }
  if (d <= 45) {
    return `Próxima: ${nextFmt}. ${label}: en ${d} días (ventana próxima). Última: ${raw}.`;
  }
  return `Próxima: ${nextFmt}. ${label}: al corriente (en ${d} días). Última: ${raw}.`;
}

/** Próxima fecha = última + `cycleMonths`; pronto ≤ `soonDays`, vencido &lt;0. */
export function renewalBucket(
  iso: string | undefined,
  cycleMonths: number,
  soonDays = 45,
): FleetRenewalBucket {
  const start = iso ? parseYmd(iso) : null;
  if (!start) {
    return 'na';
  }
  const next = addMonths(start, cycleMonths);
  const d = daysFromToday(next);
  if (d < 0) {
    return 'due';
  }
  if (d <= soonDays) {
    return 'soon';
  }
  return 'ok';
}

/** Verificaciones y cumplimiento: ventana «próximo» a 10 días (drawer + tablas + cards). */
export function complianceRenewalBucket(
  iso: string | undefined,
  cycleMonths: number,
): FleetRenewalBucket {
  return renewalBucket(iso, cycleMonths, FLEET_COMPLIANCE_SOON_DAYS);
}

/** `iso` = fecha objetivo del próximo mantenimiento (`YYYY-MM-DD`). */
export function renewalBucketFromTargetYmd(
  iso: string | undefined,
): FleetRenewalBucket {
  const next = iso?.trim() ? parseYmd(iso.trim()) : null;
  if (!next) {
    return 'na';
  }
  const d = daysFromToday(next);
  if (d < 0) {
    return 'due';
  }
  if (d <= 45) {
    return 'soon';
  }
  return 'ok';
}

function rank(b: FleetRenewalBucket): number {
  switch (b) {
    case 'due':
      return 3;
    case 'soon':
      return 2;
    case 'ok':
      return 1;
    default:
      return 0;
  }
}

function worstBucket(...buckets: FleetRenewalBucket[]): FleetRenewalBucket {
  let best: FleetRenewalBucket = 'na';
  let r = -1;
  for (const b of buckets) {
    const x = rank(b);
    if (x > r) {
      r = x;
      best = b;
    }
  }
  return best;
}

function trailerBrandLabel(u: Unit): string {
  return fleetBrandDisplayName({
    trailerBrandName: u.fleetMeta?.trailerBrandName,
    trailerBrandAbbr: u.trailerBrandAbbr,
  });
}

function modelLabel(u: Unit): string {
  const y = (u.trailerYear ?? '').trim();
  const ver = u.fleetMeta?.trailerVersion?.trim();
  const parts = [y, ver].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export function operationalKey(u: Unit, onRoute: boolean): FleetOperationalKey {
  if (onRoute) {
    return 'on_route';
  }
  return resolveUnitOperationalKey({
    persistedStatus: u.status,
    isActive: u.isActive !== false,
  });
}

function maintenanceKmRemainingFromMeta(
  meta: (UnitFleetMeta | EquipmentFleetMeta) | undefined,
  policy?: CompanyMaintenancePolicy,
): number | null {
  if (policy?.kmControlEnabled) {
    return fleetMaintenanceKmRemainingFromCounter(
      meta as UnitFleetMeta | undefined,
      policy,
    );
  }
  const persisted = meta?.maintenanceKmRemaining;
  if (
    typeof persisted === 'number' &&
    Number.isFinite(persisted) &&
    persisted >= 0
  ) {
    return persisted;
  }
  return null;
}

/** Km restantes hasta el próximo servicio (contador de unidad o valor legado). */
export function fleetMaintenanceKmRemaining(
  meta: (UnitFleetMeta | EquipmentFleetMeta) | undefined,
  policy?: CompanyMaintenancePolicy,
): number | null {
  if (policy?.kmControlEnabled) {
    return fleetMaintenanceKmRemainingFromCounter(
      meta as UnitFleetMeta | undefined,
      policy,
    );
  }
  const effective = policy
    ? effectiveFleetMetaForMaintenance(meta, policy)
    : meta;
  return maintenanceKmRemainingFromMeta(effective, policy);
}

function maintenanceBucket(
  meta: (UnitFleetMeta | EquipmentFleetMeta) | undefined,
  policy?: CompanyMaintenancePolicy,
): FleetRenewalBucket {
  const effective = policy
    ? effectiveFleetMetaForMaintenance(meta, policy)
    : meta;
  if (policy?.kmControlEnabled) {
    const rem = maintenanceKmRemainingFromMeta(effective, policy);
    if (rem == null) {
      return 'na';
    }
    if (rem <= 0) {
      return 'due';
    }
    if (rem <= 300) {
      return 'soon';
    }
    return 'ok';
  }
  if (effective?.maintenanceAlertByKm === true) {
    const rem = maintenanceKmRemainingFromMeta(effective, policy);
    if (rem == null) {
      return 'na';
    }
    if (rem <= 0) {
      return 'due';
    }
    if (rem <= 300) {
      return 'soon';
    }
    return 'ok';
  }
  const override = meta?.maintenanceNextDateOverride?.trim();
  if (override) {
    return renewalBucketFromTargetYmd(override);
  }
  const months = policy
    ? resolveMaintenanceContext(meta, policy).scheduleMonths
    : MAINT_CYCLE_MO;
  return renewalBucket(meta?.lastMaintenanceDate, months);
}

function verificationBucket(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  const phys = complianceRenewalBucket(meta?.verificationPhysMechDate, VERIF_CYCLE_MO);
  const emis = complianceRenewalBucket(meta?.verificationEmissionsDate, VERIF_CYCLE_MO);
  const doubleApplies = meta?.verificationDoubleArticulatedApplies === true;
  if (doubleApplies) {
    const double = complianceRenewalBucket(
      meta?.verificationDoubleArticulatedDate,
      VERIF_CYCLE_MO,
    );
    return worstBucket(phys, emis, double);
  }
  if (phys === 'na' && emis === 'na') {
    return 'na';
  }
  return worstBucket(phys, emis);
}

function insuranceBucket(
  meta: FleetInsuranceRenewalMeta | undefined,
  expenses?: readonly Expense[],
): FleetRenewalBucket {
  const policy = meta?.insurancePolicyNumber?.trim();
  const anchor = insurancePaymentAnchor(meta);
  if (!policy && !anchor) {
    return 'na';
  }

  if (expenses) {
    const scheduleCompliance = insurancePaymentCompliance(meta, { expenses });
    if (scheduleCompliance) {
      return scheduleCompliance.bucket;
    }
  }

  if (!anchor) {
    return 'ok';
  }
  const next = nextInsurancePaymentDateFromUtil(meta);
  if (!next) {
    return 'ok';
  }
  const d = daysFromToday(next);
  if (d < 0) {
    return 'due';
  }
  if (d <= FLEET_COMPLIANCE_SOON_DAYS) {
    return 'soon';
  }
  return 'ok';
}

export function fleetComplianceFromUnitMeta(
  meta: UnitFleetMeta | undefined,
): FleetComplianceSummary {
  const verifBucket = fleetVerificationRenewal(meta);
  const insBucket = fleetInsuranceRenewal(meta);
  return {
    verifBucket,
    insBucket,
    verifLabel: fleetRenewalBucketLabel(verifBucket),
    insLabel: fleetRenewalBucketLabel(insBucket),
    verifNext: nextVerificationTableDate(meta) ?? '—',
    insNext: nextInsuranceTableDate(meta) ?? '—',
  };
}

export function fleetComplianceFromEquipment(
  equipment: Equipment,
): FleetComplianceSummary {
  const meta = equipment.fleetMeta;
  const verifBucket = equipmentPhysMechVerificationBucket(equipment, meta);
  const insBucket = fleetInsuranceRenewal(meta);
  return {
    verifBucket,
    insBucket,
    verifLabel: fleetRenewalBucketLabel(verifBucket),
    insLabel: fleetRenewalBucketLabel(insBucket),
    verifNext: nextEquipmentPhysMechTableDate(equipment, meta) ?? '—',
    insNext: nextInsuranceTableDate(meta) ?? '—',
  };
}

export function fleetMaintenanceRenewal(
  meta: (UnitFleetMeta | EquipmentFleetMeta) | undefined,
  policy?: CompanyMaintenancePolicy,
): FleetRenewalBucket {
  return maintenanceBucket(meta, policy);
}

export function fleetVerificationRenewal(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  return verificationBucket(meta);
}

export function fleetInsuranceRenewal(
  meta: FleetInsuranceRenewalMeta | undefined,
  expenses?: readonly Expense[],
): FleetRenewalBucket {
  return insuranceBucket(meta, expenses);
}

function nextGpsPaymentDate(meta: UnitFleetMeta | undefined): Date | null {
  return nextGpsPaymentDateFromUtil(meta);
}

function gpsBucket(
  meta: UnitFleetMeta | undefined,
  expenses?: readonly Expense[],
): FleetRenewalBucket {
  if (!meta?.hasGps) {
    return 'na';
  }
  const iso = meta.gpsContractDate?.trim();
  if (!iso) {
    return 'ok';
  }

  if (expenses) {
    const scheduleCompliance = gpsPaymentCompliance(meta, { expenses });
    if (scheduleCompliance) {
      return scheduleCompliance.bucket;
    }
  }

  const next = nextGpsPaymentDate(meta);
  if (!next) {
    return 'ok';
  }
  const d = daysFromToday(next);
  if (d < 0) {
    return 'due';
  }
  if (d <= FLEET_COMPLIANCE_SOON_DAYS) {
    return 'soon';
  }
  return 'ok';
}

export function fleetGpsRenewal(
  meta: UnitFleetMeta | undefined,
  expenses?: readonly Expense[],
): FleetRenewalBucket {
  return gpsBucket(meta, expenses);
}

/** Próximo ciclo de pago GPS (solo fecha) para detalle / tablas. */
export function nextGpsTableDate(meta: UnitFleetMeta | undefined): string | null {
  const next = nextGpsPaymentDate(meta);
  return next ? fmtMx(next) : null;
}

/** Fecha ISO `YYYY-MM-DD` a etiqueta corta es-MX, o `—`. */
export function formatFleetYmdMx(iso: string | undefined): string {
  const raw = iso?.trim();
  if (!raw) {
    return '—';
  }
  const d = parseYmd(raw);
  return d ? fmtMx(d) : raw;
}

const VERIF_CYCLE_MO = 6;
const MAINT_CYCLE_MO = 6;

function nextCycleDate(iso: string | undefined, cycleMonths: number): Date | null {
  const raw = iso?.trim();
  if (!raw) {
    return null;
  }
  const start = parseYmd(raw);
  if (!start) {
    return null;
  }
  return addMonths(start, cycleMonths);
}

function nextInsurancePaymentDate(meta: FleetInsuranceRenewalMeta | undefined): Date | null {
  return nextInsurancePaymentDateFromUtil(meta);
}

function formatYmdFromDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Fecha ISO del próximo mantenimiento por tiempo (override o último + ciclo). */
export function nextMaintenanceDueIso(
  meta: FleetLastMaintenanceMeta | undefined,
  policy?: CompanyMaintenancePolicy,
): string | null {
  const override = meta?.maintenanceNextDateOverride?.trim();
  if (override && parseYmd(override)) {
    return /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : null;
  }
  const months = policy
    ? resolveMaintenanceContext(meta, policy).scheduleMonths
    : MAINT_CYCLE_MO;
  const d = nextCycleDate(meta?.lastMaintenanceDate, months);
  return d ? formatYmdFromDate(d) : null;
}

/** Fecha próxima (solo etiqueta localizada) para celda de tabla: mantenimiento. */
export function nextMaintenanceTableDate(
  meta: FleetLastMaintenanceMeta | undefined,
  policy?: CompanyMaintenancePolicy,
): string | null {
  const override = meta?.maintenanceNextDateOverride?.trim();
  if (override) {
    const d = parseYmd(override);
    return d ? fmtMx(d) : null;
  }
  const months = policy
    ? resolveMaintenanceContext(meta, policy).scheduleMonths
    : MAINT_CYCLE_MO;
  const d = nextCycleDate(meta?.lastMaintenanceDate, months);
  return d ? fmtMx(d) : null;
}

/** La verificación que venza antes (misma cadencia 6 meses que el icono). */
export function nextVerificationTableDate(meta: UnitFleetMeta | undefined): string | null {
  const dates: Date[] = [];
  const push = (iso: string | undefined) => {
    const d = nextCycleDate(iso, VERIF_CYCLE_MO);
    if (d) {
      dates.push(d);
    }
  };
  push(meta?.verificationPhysMechDate);
  push(meta?.verificationEmissionsDate);
  if (meta?.verificationDoubleArticulatedApplies === true) {
    push(meta?.verificationDoubleArticulatedDate);
  }
  if (!dates.length) {
    return null;
  }
  const earliest = dates.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
  return fmtMx(earliest);
}

/** Próximo pago de seguro (solo fecha) para celda de tabla. */
export function nextInsuranceTableDate(meta: FleetInsuranceRenewalMeta | undefined): string | null {
  const next = nextInsurancePaymentDate(meta);
  return next ? fmtMx(next) : null;
}

/** Texto corto para UI: siguiente vencimiento a N meses desde la última fecha ISO. */
export function nextCycleFormatted(
  iso: string | undefined,
  cycleMonths: number,
): string | null {
  const next = nextCycleDate(iso, cycleMonths);
  return next ? `Próxima: ${fmtMx(next)}` : null;
}

/** Próxima fecha de pago según contrato y cadencia (misma lógica que el icono de seguro). */
export function nextInsurancePaymentFormatted(meta: UnitFleetMeta | undefined): string | null {
  const next = nextInsurancePaymentDate(meta);
  return next ? `Próximo pago: ${fmtMx(next)}` : null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Fin del período de exención de 2 años para verificación físico-mecánica de equipo
 * (regla de agencia y/o modelo del año calendario en curso). Si aplican ambas, se usa la fecha más tardía.
 */
export function equipmentPhysMechTwoYearExemptionEnd(
  equipment: Equipment,
  meta: EquipmentFleetMeta | undefined,
  refNow = new Date(),
): Date | null {
  const ends: Date[] = [];
  const cy = refNow.getFullYear();
  if (meta?.equipmentOperatedByAgency === true) {
    const startIso =
      meta.physMechTwoYearExemptStartDate?.trim() || equipment.lastServiceDate?.trim();
    const start = startIso ? parseYmd(startIso) : null;
    if (start) {
      ends.push(addYears(start, 2));
    }
  }
  const modelYear = Number.parseInt((equipment.trailerYear ?? '').trim(), 10);
  if (Number.isFinite(modelYear) && modelYear === cy) {
    ends.push(addYears(new Date(modelYear, 0, 1), 2));
  }
  if (!ends.length) {
    return null;
  }
  return ends.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
}

function equipmentWithinPhysMechTwoYearExemption(
  equipment: Equipment,
  meta: EquipmentFleetMeta | undefined,
  refNow = new Date(),
): boolean {
  const end = equipmentPhysMechTwoYearExemptionEnd(equipment, meta, refNow);
  if (!end) {
    return false;
  }
  return startOfDay(refNow).getTime() < startOfDay(end).getTime();
}

/** Solo físico-mecánica; respeta exención de 2 años (agencia / modelo año en curso). */
export function equipmentPhysMechVerificationBucket(
  equipment: Equipment,
  meta: EquipmentFleetMeta | undefined,
  refNow = new Date(),
): FleetRenewalBucket {
  if (equipmentWithinPhysMechTwoYearExemption(equipment, meta, refNow)) {
    return 'ok';
  }
  return complianceRenewalBucket(meta?.verificationPhysMechDate, VERIF_CYCLE_MO);
}

export function equipmentPhysMechVerificationTooltip(
  equipment: Equipment,
  meta: EquipmentFleetMeta | undefined,
  refNow = new Date(),
): string {
  if (equipmentWithinPhysMechTwoYearExemption(equipment, meta, refNow)) {
    const end = equipmentPhysMechTwoYearExemptionEnd(equipment, meta, refNow)!;
    const endFmt = fmtMx(end);
    const bits: string[] = [];
    if (meta?.equipmentOperatedByAgency === true) {
      bits.push('equipo de agencia');
    }
    const y = Number.parseInt((equipment.trailerYear ?? '').trim(), 10);
    if (Number.isFinite(y) && y === refNow.getFullYear()) {
      bits.push(`modelo ${y} (año en curso)`);
    }
    const why = bits.length ? ` Motivo: ${bits.join(' · ')}.` : '';
    return `Verificación físico-mecánica: no aplica el ciclo de 6 meses durante 2 años.${why} El seguimiento de verificación rige a partir del ${endFmt}.`;
  }
  return lineRenewal('Físico-mecánica (equipo)', meta?.verificationPhysMechDate, VERIF_CYCLE_MO);
}

export function nextEquipmentPhysMechTableDate(
  equipment: Equipment,
  meta: EquipmentFleetMeta | undefined,
  refNow = new Date(),
): string | null {
  if (equipmentWithinPhysMechTwoYearExemption(equipment, meta, refNow)) {
    const end = equipmentPhysMechTwoYearExemptionEnd(equipment, meta, refNow);
    return end ? fmtMx(end) : null;
  }
  const d = nextCycleDate(meta?.verificationPhysMechDate, VERIF_CYCLE_MO);
  return d ? fmtMx(d) : null;
}

export function buildFleetUnitTableRow(
  u: Unit,
  options: {
    onRoute: boolean;
    operationalOverride?: FleetOperationalKey;
    hitchedEquipment?: Equipment[];
  },
): Record<string, unknown> {
  const meta = u.fleetMeta;
  const hitched = options.hitchedEquipment ?? [];
  return {
    id: u.id,
    fleetBrand: trailerBrandLabel(u),
    fleetModel: modelLabel(u),
    fleetPlate: u.plate.trim() || '—',
    fleetConfigBadges: fleetUnitConvoyTableBadges(hitched, u.transportType),
    fleetOperational:
      options.operationalOverride ?? operationalKey(u, options.onRoute),
    fleetMaint: maintenanceBucket(meta),
    fleetVerif: verificationBucket(meta),
    fleetIns: insuranceBucket(meta),
    fleetMaintNext: nextMaintenanceTableDate(meta),
    fleetVerifNext: nextVerificationTableDate(meta),
    fleetInsNext: nextInsuranceTableDate(meta),
  };
}

function equipmentOperationValueFromLabel(label: string | undefined): string {
  if (!label) {
    return '';
  }
  const t = label.trim().toLowerCase();
  return (
    EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.label.trim().toLowerCase() === t)?.value ?? ''
  );
}

function equipmentBrandLabel(e: Equipment): string {
  return fleetBrandDisplayName({
    trailerBrandName: e.fleetMeta?.trailerBrandName,
    trailerBrandAbbr: e.trailerBrandAbbr,
  });
}

function equipmentModelLabel(e: Equipment): string {
  const y = (e.trailerYear ?? '').trim();
  return y || '—';
}

function equipmentTypeLabel(e: Equipment): string {
  const typeRaw = (e.type ?? '').trim();
  if (!typeRaw) {
    return '—';
  }
  if (EQUIPMENT_OPERATION_TYPE_OPTIONS.some((o) => o.value === typeRaw)) {
    return EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === typeRaw)!.label;
  }
  const value = equipmentOperationValueFromLabel(typeRaw);
  if (value) {
    return EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? typeRaw;
  }
  return typeRaw;
}

export function operationalKeyEquipment(
  e: Equipment,
  onRoute: boolean,
): FleetOperationalKey {
  if (onRoute) {
    return 'on_route';
  }
  return resolveUnitOperationalKey({
    persistedStatus: e.status,
    isActive: e.isActive !== false,
  });
}

/** Fila de tabla Flota «Equipos»: mismas celdas de mantenimiento y seguro que la tabla de unidades. */
export function buildFleetEquipmentTableRow(
  e: Equipment,
  options: {
    onRoute: boolean;
    operationalOverride?: FleetOperationalKey;
  },
): Record<string, unknown> {
  const meta = e.fleetMeta;
  const rowMaintMeta = meta;
  const maintMeta: FleetLastMaintenanceMeta | undefined = rowMaintMeta
    ? {
        lastMaintenanceDate: rowMaintMeta.lastMaintenanceDate,
        maintenanceNextDateOverride: rowMaintMeta.maintenanceNextDateOverride,
      }
    : undefined;
  const insMeta: FleetInsuranceRenewalMeta | undefined = meta
    ? {
        insurancePolicyNumber: meta.insurancePolicyNumber,
        insuranceCarrierName: meta.insuranceCarrierName,
        insuranceContractDate: meta.insuranceContractDate,
        insuranceLastPaymentDate: meta.insuranceLastPaymentDate,
        insurancePaymentCadence: meta.insurancePaymentCadence,
      }
    : undefined;

  return {
    id: e.id,
    fleetBrand: equipmentBrandLabel(e),
    fleetModel: equipmentModelLabel(e),
    fleetUnitType: equipmentTypeLabel(e),
    fleetPlate: e.plate?.trim() || '—',
    fleetOperational:
      options.operationalOverride ??
      operationalKeyEquipment(e, options.onRoute),
    fleetMaint: maintenanceBucket(rowMaintMeta),
    fleetVerif: equipmentPhysMechVerificationBucket(e, meta),
    fleetIns: insuranceBucket(insMeta),
    fleetMaintNext: nextMaintenanceTableDate(maintMeta),
    fleetVerifNext: nextEquipmentPhysMechTableDate(e, meta),
    fleetInsNext: nextInsuranceTableDate(insMeta),
  };
}
