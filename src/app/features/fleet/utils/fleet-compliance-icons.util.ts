import type {
  Equipment,
  EquipmentFleetMeta,
  Expense,
  Unit,
  UnitFleetMeta,
} from '@shared/models/logistics.models';
import { gpsPaymentCompliance } from '@features/fleet/utils/fleet-gps-schedule.util';
import { daysUntilGpsPayment } from '@features/fleet/utils/fleet-gps-payment.util';
import { daysUntilInsurancePayment } from '@features/fleet/utils/fleet-insurance-payment.util';
import { insurancePaymentCompliance } from '@features/fleet/utils/fleet-insurance-schedule.util';
import {
  equipmentPhysMechVerificationBucket,
  fleetGpsRenewal,
  fleetInsuranceRenewal,
  fleetVerificationRenewal,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';

export type FleetComplianceIconKind = 'verification' | 'insurance' | 'gps';

export type FleetComplianceExpenseContext = {
  insuranceExpenses?: readonly Expense[];
  gpsExpenses?: readonly Expense[];
};

export type FleetComplianceIconView = {
  kind: FleetComplianceIconKind;
  bucket: FleetRenewalBucket;
  tooltip: string;
};

const VERIF_CYCLE_MO = 6;

function parseYmd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(`${t}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
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

function daysUntilComplianceCycle(
  iso: string | undefined,
  cycleMonths: number,
): number | null {
  const start = iso?.trim() ? parseYmd(iso) : null;
  if (!start) {
    return null;
  }
  return daysFromToday(addMonths(start, cycleMonths));
}

function daysUntilUnitVerificationRenewal(meta: UnitFleetMeta | undefined): number | null {
  const candidates: number[] = [];
  const phys = daysUntilComplianceCycle(meta?.verificationPhysMechDate, VERIF_CYCLE_MO);
  if (phys != null) {
    candidates.push(phys);
  }
  const emis = daysUntilComplianceCycle(meta?.verificationEmissionsDate, VERIF_CYCLE_MO);
  if (emis != null) {
    candidates.push(emis);
  }
  if (meta?.verificationDoubleArticulatedApplies === true) {
    const dbl = daysUntilComplianceCycle(
      meta?.verificationDoubleArticulatedDate,
      VERIF_CYCLE_MO,
    );
    if (dbl != null) {
      candidates.push(dbl);
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  return Math.min(...candidates);
}

function daysUntilEquipmentVerificationRenewal(
  equipment: Equipment,
  meta: EquipmentFleetMeta | undefined,
): number | null {
  if (equipmentPhysMechVerificationBucket(equipment, meta) === 'ok') {
    const phys = daysUntilComplianceCycle(meta?.verificationPhysMechDate, VERIF_CYCLE_MO);
    if (phys != null) {
      return phys;
    }
    return null;
  }
  return daysUntilComplianceCycle(meta?.verificationPhysMechDate, VERIF_CYCLE_MO);
}

function coveragePaymentIconTooltip(
  kind: 'insurance' | 'gps',
  bucket: FleetRenewalBucket,
  daysUntil: number | null,
): string {
  const label = kind === 'insurance' ? 'Seguro' : 'GPS';
  if (bucket === 'due') {
    return `${label}: Vencido.`;
  }
  if (bucket === 'soon') {
    if (daysUntil == null) {
      return `${label}: Próximo pago.`;
    }
    if (daysUntil <= 0) {
      return `${label}: Próximo pago hoy.`;
    }
    if (daysUntil === 1) {
      return `${label}: Próximo pago en 1 día.`;
    }
    return `${label}: Próximo pago en ${daysUntil} días.`;
  }
  return `${label}: Vigente.`;
}

function verificationIconTooltip(
  bucket: FleetRenewalBucket,
  daysUntil: number | null,
): string {
  if (bucket === 'due') {
    return 'Verificación: Vencida.';
  }
  if (bucket === 'soon') {
    if (daysUntil == null) {
      return 'Verificación: Próxima a vencer.';
    }
    if (daysUntil <= 0) {
      return 'Verificación: Vence hoy.';
    }
    if (daysUntil === 1) {
      return 'Verificación: Próximo vencimiento en 1 día.';
    }
    return `Verificación: Próximo vencimiento en ${daysUntil} días.`;
  }
  return 'Verificación: Vigente.';
}

function iconTooltip(
  kind: FleetComplianceIconKind,
  bucket: FleetRenewalBucket,
  daysUntil: number | null,
): string {
  if (kind === 'insurance') {
    return coveragePaymentIconTooltip('insurance', bucket, daysUntil);
  }
  if (kind === 'gps') {
    return coveragePaymentIconTooltip('gps', bucket, daysUntil);
  }
  return verificationIconTooltip(bucket, daysUntil);
}

function insuranceComplianceDaysUntil(
  meta: UnitFleetMeta | EquipmentFleetMeta | undefined,
  expenses?: readonly Expense[],
): number | null {
  if (expenses) {
    const schedule = insurancePaymentCompliance(meta, { expenses });
    if (schedule) {
      return schedule.daysUntil;
    }
  }
  return daysUntilInsurancePayment(meta);
}

function gpsComplianceDaysUntil(
  meta: UnitFleetMeta | undefined,
  expenses?: readonly Expense[],
): number | null {
  if (expenses) {
    const schedule = gpsPaymentCompliance(meta, { expenses });
    if (schedule) {
      return schedule.daysUntil;
    }
  }
  return daysUntilGpsPayment(meta);
}

function pushIcon(
  items: FleetComplianceIconView[],
  kind: FleetComplianceIconKind,
  bucket: FleetRenewalBucket,
  daysUntil: number | null,
): void {
  if (bucket === 'na') {
    return;
  }
  items.push({
    kind,
    bucket,
    tooltip: iconTooltip(kind, bucket, daysUntil),
  });
}

export function fleetComplianceIconsForUnit(
  unit: Unit | undefined,
  ctx?: FleetComplianceExpenseContext,
): FleetComplianceIconView[] {
  const meta = unit?.fleetMeta;
  const items: FleetComplianceIconView[] = [];
  pushIcon(
    items,
    'verification',
    fleetVerificationRenewal(meta),
    daysUntilUnitVerificationRenewal(meta),
  );
  pushIcon(
    items,
    'insurance',
    fleetInsuranceRenewal(meta, ctx?.insuranceExpenses),
    insuranceComplianceDaysUntil(meta, ctx?.insuranceExpenses),
  );
  pushIcon(
    items,
    'gps',
    fleetGpsRenewal(meta, ctx?.gpsExpenses),
    gpsComplianceDaysUntil(meta, ctx?.gpsExpenses),
  );
  return items;
}

export function fleetComplianceIconsForEquipment(
  equipment: Equipment | undefined,
  ctx?: FleetComplianceExpenseContext,
): FleetComplianceIconView[] {
  if (!equipment) {
    return [];
  }
  const meta = equipment.fleetMeta;
  const items: FleetComplianceIconView[] = [];
  pushIcon(
    items,
    'verification',
    equipmentPhysMechVerificationBucket(equipment, meta),
    daysUntilEquipmentVerificationRenewal(equipment, meta),
  );
  pushIcon(
    items,
    'insurance',
    fleetInsuranceRenewal(meta, ctx?.insuranceExpenses),
    insuranceComplianceDaysUntil(meta, ctx?.insuranceExpenses),
  );
  return items;
}
