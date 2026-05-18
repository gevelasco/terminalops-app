import type {
  Equipment,
  EquipmentFleetMeta,
  TrailerTenureMode,
  Unit,
  UnitFleetMeta,
} from '@shared/models/logistics.models';
import type { ReportsBarSlice } from '../models/reports-view.models';
import { countBarFillClass } from './reports-chart-mappers';

export type FleetPayableCategoryId =
  | 'insurance'
  | 'verification'
  | 'debt_unit'
  | 'debt_equipment';

const CATEGORY_LABELS: Record<FleetPayableCategoryId, string> = {
  insurance: 'Seguro',
  verification: 'Verificaciones',
  debt_unit: 'Deuda (unidad)',
  debt_equipment: 'Deuda (equipo)',
};

const CATEGORY_ORDER: FleetPayableCategoryId[] = [
  'insurance',
  'verification',
  'debt_unit',
  'debt_equipment',
];

const FILL_PREFIX = 'reports-chart-bar__fill--expense';

function parseIsoDay(iso?: string): Date | null {
  if (!iso?.trim()) {
    return null;
  }
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function cadenceMonths(cadence?: string): number {
  const c = cadence?.trim().toLowerCase() ?? '';
  if (c.includes('seman')) {
    return 0.25;
  }
  if (c.includes('mensual') || c === 'monthly') {
    return 1;
  }
  if (c.includes('trim')) {
    return 3;
  }
  if (c.includes('semest')) {
    return 6;
  }
  if (c.includes('anual') || c === 'annual') {
    return 12;
  }
  return 12;
}

function isDueOrUpcoming(
  referenceIso: string,
  anchorIso: string | undefined,
  cycleMonths: number,
  horizonDays = 365,
): boolean {
  const ref = parseIsoDay(referenceIso);
  const anchor = parseIsoDay(anchorIso);
  if (!ref || !anchor) {
    return false;
  }
  const due = addMonths(anchor, cycleMonths);
  const horizon = new Date(ref);
  horizon.setDate(horizon.getDate() + horizonDays);
  return due <= horizon;
}

function sumUnitVerificationPayable(meta: UnitFleetMeta, asOf: string): number {
  let total = 0;
  const phys = meta.verificationPhysMechCost ?? 0;
  if (phys > 0 && isDueOrUpcoming(asOf, meta.verificationPhysMechDate, 12)) {
    total += phys;
  }
  const emissions = meta.verificationEmissionsCost ?? 0;
  if (emissions > 0 && isDueOrUpcoming(asOf, meta.verificationEmissionsDate, 12)) {
    total += emissions;
  }
  if (meta.verificationDoubleArticulatedApplies) {
    const dbl = meta.verificationDoubleArticulatedCost ?? 0;
    if (dbl > 0 && isDueOrUpcoming(asOf, meta.verificationDoubleArticulatedDate, 12)) {
      total += dbl;
    }
  }
  return total;
}

function sumEquipmentVerificationPayable(meta: EquipmentFleetMeta, asOf: string): number {
  const phys = meta.verificationPhysMechCost ?? 0;
  if (phys > 0 && isDueOrUpcoming(asOf, meta.verificationPhysMechDate, 12)) {
    return phys;
  }
  return 0;
}

function insurancePayable(meta: UnitFleetMeta | EquipmentFleetMeta, asOf: string): number {
  const cost = meta.insuranceCost ?? 0;
  if (cost <= 0 || !meta.insurancePolicyNumber?.trim()) {
    return 0;
  }
  if (!meta.insuranceContractDate?.trim()) {
    return cost;
  }
  return isDueOrUpcoming(
    asOf,
    meta.insuranceContractDate,
    cadenceMonths(meta.insurancePaymentCadence),
  )
    ? cost
    : 0;
}

function gpsPayable(meta: UnitFleetMeta, asOf: string): number {
  if (!meta.hasGps || meta.gpsCoveredByInsuranceEndorsement) {
    return 0;
  }
  const cost = meta.gpsPrice ?? 0;
  if (cost <= 0) {
    return 0;
  }
  if (!meta.gpsContractDate?.trim()) {
    return cost;
  }
  return isDueOrUpcoming(
    asOf,
    meta.gpsContractDate,
    cadenceMonths(meta.gpsPaymentCadence),
  )
    ? cost
    : 0;
}

function creditLeasePayable(
  mode: TrailerTenureMode | undefined,
  meta: UnitFleetMeta | EquipmentFleetMeta,
  asOf: string,
): number {
  if (mode !== 'financed' && mode !== 'leased') {
    return 0;
  }
  const amount = meta.trailerRecurringPaymentAmount ?? 0;
  if (amount <= 0) {
    return 0;
  }
  const date = meta.trailerRecurringPaymentDate;
  if (!date?.trim()) {
    return amount;
  }
  const ref = parseIsoDay(asOf);
  const due = parseIsoDay(date);
  if (!ref || !due) {
    return amount;
  }
  const horizon = new Date(ref);
  horizon.setDate(horizon.getDate() + 45);
  return due <= horizon ? amount : 0;
}

function managedPayable(
  mode: TrailerTenureMode | undefined,
  meta: UnitFleetMeta | EquipmentFleetMeta,
): number {
  if (mode !== 'managed') {
    return 0;
  }
  return Math.max(0, meta.trailerManagementOwnerPayout ?? 0);
}

function unitDebtPayable(meta: UnitFleetMeta, asOf: string): number {
  const mode = meta.trailerTenureMode;
  return (
    creditLeasePayable(mode, meta, asOf) +
    gpsPayable(meta, asOf) +
    managedPayable(mode, meta)
  );
}

function equipmentDebtPayable(meta: EquipmentFleetMeta, asOf: string): number {
  const mode = meta.trailerTenureMode;
  return creditLeasePayable(mode, meta, asOf) + managedPayable(mode, meta);
}

function accumulateUnitMeta(
  totals: Map<FleetPayableCategoryId, number>,
  meta: UnitFleetMeta | undefined,
  asOf: string,
): void {
  if (!meta) {
    return;
  }

  totals.set('insurance', (totals.get('insurance') ?? 0) + insurancePayable(meta, asOf));
  totals.set(
    'verification',
    (totals.get('verification') ?? 0) + sumUnitVerificationPayable(meta, asOf),
  );
  totals.set('debt_unit', (totals.get('debt_unit') ?? 0) + unitDebtPayable(meta, asOf));
}

function accumulateEquipmentMeta(
  totals: Map<FleetPayableCategoryId, number>,
  meta: EquipmentFleetMeta | undefined,
  asOf: string,
): void {
  if (!meta) {
    return;
  }

  totals.set('insurance', (totals.get('insurance') ?? 0) + insurancePayable(meta, asOf));
  totals.set(
    'verification',
    (totals.get('verification') ?? 0) + sumEquipmentVerificationPayable(meta, asOf),
  );
  totals.set(
    'debt_equipment',
    (totals.get('debt_equipment') ?? 0) + equipmentDebtPayable(meta, asOf),
  );
}

function toFixedBarSlices(
  totals: Map<FleetPayableCategoryId, number>,
): ReportsBarSlice[] {
  const rows = CATEGORY_ORDER.map((id) => ({
    key: id,
    label: CATEGORY_LABELS[id],
    amount: Math.round(totals.get(id) ?? 0),
  }));
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  let assigned = 0;

  return rows.map((r, index) => {
    const pct =
      total <= 0
        ? 0
        : index === rows.length - 1
          ? Math.max(0, 100 - assigned)
          : Math.round((r.amount / total) * 100);
    if (total > 0) {
      assigned += pct;
    }
    return {
      key: r.key,
      label: r.label,
      count: r.amount,
      pct,
      fillClass: countBarFillClass(FILL_PREFIX, index),
    };
  });
}

/** Siempre devuelve Seguros, Verificaciones, Deuda (unidad) y Deuda (equipo). */
export function buildFleetPayablesBarSlices(
  units: readonly Unit[],
  equipment: readonly Equipment[],
  asOfIso: string,
): ReportsBarSlice[] {
  const totals = new Map<FleetPayableCategoryId, number>();
  for (const id of CATEGORY_ORDER) {
    totals.set(id, 0);
  }

  for (const unit of units) {
    accumulateUnitMeta(totals, unit.fleetMeta, asOfIso);
  }
  for (const eq of equipment) {
    accumulateEquipmentMeta(totals, eq.fleetMeta, asOfIso);
  }

  return toFixedBarSlices(totals);
}

export function fleetPayablesTotal(slices: readonly ReportsBarSlice[]): number {
  return slices.reduce((sum, s) => sum + s.count, 0);
}
