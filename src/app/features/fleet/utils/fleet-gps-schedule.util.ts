import type { Expense } from '@shared/models/logistics.models';
import { expenseIncurredDateInput } from '@features/expenses/utils/expenses-form.util';
import {
  GPS_PAYMENT_CONFIRM_WINDOW_DAYS,
  cadenceToMonths,
  gpsFleetMetaIsActive,
  type FleetGpsPaymentMeta,
} from './fleet-gps-payment.util';
import {
  compactInsurancePaymentSchedule,
  insuranceScheduleStatusLabel,
  type InsuranceScheduleRow,
  type InsuranceScheduleRowStatus,
} from './fleet-insurance-schedule.util';
import {
  fleetCycleIsPaid,
  fleetPaymentExpenseForCycle,
} from './fleet-payment-schedule-match.util';

export type GpsScheduleRow = InsuranceScheduleRow;
export type GpsScheduleRowStatus = InsuranceScheduleRowStatus;

function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfToday(today: Date): Date {
  const d = new Date(today.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function gpsSchedulePeriodCount(cadence: string | undefined): number {
  const months = cadenceToMonths(cadence);
  if (months === 1) {
    return 12;
  }
  if (months === 3) {
    return 4;
  }
  return 0;
}

export function isAnnualGpsCadence(cadence: string | undefined): boolean {
  return cadenceToMonths(cadence) === 12;
}

export function showGpsPaymentSchedule(meta: FleetGpsPaymentMeta | undefined): boolean {
  return gpsFleetMetaIsActive(meta) && gpsSchedulePeriodCount(meta?.gpsPaymentCadence) > 0;
}

export function gpsServiceYearBounds(
  meta: FleetGpsPaymentMeta | undefined,
  today: Date = new Date(),
): { from: string; to: string } | null {
  const contract = meta?.gpsContractDate?.trim();
  if (!contract) {
    return null;
  }
  const contractDate = parseYmd(contract);
  if (!contractDate) {
    return null;
  }
  const yearStart = policyYearStart(contractDate, today);
  const yearEnd = addMonths(yearStart, 12);
  yearEnd.setDate(yearEnd.getDate() - 1);
  return { from: formatYmd(yearStart), to: formatYmd(yearEnd) };
}

function policyYearStart(contractDate: Date, today: Date): Date {
  const anchor = startOfToday(today);
  const elapsed = monthsBetween(contractDate, anchor);
  const yearIndex = Math.max(0, Math.floor(elapsed / 12));
  return addMonths(contractDate, yearIndex * 12);
}

function scheduleLabel(index: number, cadenceMonths: number): string {
  if (cadenceMonths === 1) {
    return `Mes ${index}`;
  }
  if (cadenceMonths === 3) {
    return `T${index}`;
  }
  return `Pago ${index}`;
}

function isGpsPaymentExpense(e: Expense): boolean {
  const desc = (e.description ?? '').trim();
  return (
    e.kind === 'gps' &&
    (desc.startsWith('Pago de GPS') || desc.startsWith('Contratación de GPS'))
  );
}

function expensePaidYmd(e: Expense): string {
  if (e.paidAt) {
    return expenseIncurredDateInput(e.paidAt);
  }
  return expenseIncurredDateInput(e.incurredAt);
}

export function buildGpsPaymentSchedule(params: {
  meta: FleetGpsPaymentMeta | undefined;
  expenses: readonly Expense[];
  today?: Date;
}): GpsScheduleRow[] {
  const meta = params.meta;
  if (!gpsFleetMetaIsActive(meta)) {
    return [];
  }
  const cadenceMonths = cadenceToMonths(meta?.gpsPaymentCadence);
  const periodCount = gpsSchedulePeriodCount(meta?.gpsPaymentCadence);
  const contract = meta?.gpsContractDate?.trim();
  if (!contract || periodCount === 0) {
    return [];
  }

  const contractDate = parseYmd(contract);
  if (!contractDate) {
    return [];
  }

  const today = startOfToday(params.today ?? new Date());
  const yearStart = policyYearStart(contractDate, today);
  const stepMonths = cadenceMonths === 1 ? 1 : 3;

  const paymentExpenses = params.expenses.filter(isGpsPaymentExpense);
  const lastPaymentDate = meta?.gpsLastPaymentDate?.trim();

  const rows: GpsScheduleRow[] = [];
  let nextUnpaidIndex = -1;

  for (let i = 0; i < periodCount; i += 1) {
    const due = addMonths(yearStart, i * stepMonths);
    const dueDate = formatYmd(due);
    const matched = fleetPaymentExpenseForCycle(
      dueDate,
      lastPaymentDate,
      paymentExpenses,
      i + 1,
    );
    const paid = fleetCycleIsPaid(dueDate, lastPaymentDate, matched);

    let status: GpsScheduleRowStatus;
    if (paid) {
      status = 'paid';
    } else if (due.getTime() < today.getTime()) {
      status = 'overdue';
    } else {
      const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
      status = daysUntil <= GPS_PAYMENT_CONFIRM_WINDOW_DAYS ? 'due' : 'future';
    }

    if (!paid && nextUnpaidIndex < 0) {
      nextUnpaidIndex = i;
    }

    rows.push({
      index: i + 1,
      label: scheduleLabel(i + 1, cadenceMonths),
      dueDate,
      status,
      expenseId: matched?.id,
      paidDate: paid && matched ? expensePaidYmd(matched) : undefined,
      paidAmount: paid ? matched?.amount : undefined,
      canConfirm: false,
    });
  }

  if (nextUnpaidIndex >= 0) {
    const row = rows[nextUnpaidIndex];
    if (row.status === 'overdue' || row.status === 'due') {
      row.canConfirm = true;
    }
  }

  return rows;
}

export const compactGpsPaymentSchedule = compactInsurancePaymentSchedule;
export const gpsScheduleStatusLabel = insuranceScheduleStatusLabel;

export type GpsPaymentCompliance = {
  bucket: 'ok' | 'soon' | 'due';
  daysUntil: number | null;
};

/** Misma regla que seguro: el primer ciclo impago define vencido vs por pagar. */
export function gpsPaymentCompliance(
  meta: FleetGpsPaymentMeta | undefined,
  options?: { expenses?: readonly Expense[]; today?: Date },
): GpsPaymentCompliance | null {
  if (!showGpsPaymentSchedule(meta)) {
    return null;
  }
  const contract = meta?.gpsContractDate?.trim();
  if (!contract) {
    return null;
  }

  const rows = buildGpsPaymentSchedule({
    meta,
    expenses: options?.expenses ?? [],
    today: options?.today,
  });
  if (rows.length === 0) {
    return null;
  }

  const nextUnpaid = rows.find((row) => row.status !== 'paid');
  if (!nextUnpaid) {
    return { bucket: 'ok', daysUntil: null };
  }

  const due = parseYmd(nextUnpaid.dueDate);
  const today = startOfToday(options?.today ?? new Date());
  const daysUntil = due
    ? Math.round((due.getTime() - today.getTime()) / 86400000)
    : null;

  if (nextUnpaid.status === 'overdue') {
    return { bucket: 'due', daysUntil };
  }
  if (nextUnpaid.status === 'due') {
    return { bucket: 'soon', daysUntil };
  }
  return { bucket: 'ok', daysUntil };
}
