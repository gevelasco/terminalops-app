import type { Expense } from '@shared/models/logistics.models';
import { expenseIncurredDateInput } from '@features/expenses/utils/expenses-form.util';
import {
  INSURANCE_PAYMENT_CONFIRM_WINDOW_DAYS,
  cadenceToMonths,
  type FleetInsurancePaymentMeta,
} from './fleet-insurance-payment.util';
import {
  fleetCycleIsPaid,
  fleetPaymentExpenseForCycle,
} from './fleet-payment-schedule-match.util';

export type InsuranceScheduleRowStatus = 'paid' | 'future' | 'due' | 'overdue';

export type InsuranceScheduleRow = {
  index: number;
  label: string;
  dueDate: string;
  status: InsuranceScheduleRowStatus;
  expenseId?: string;
  paidDate?: string;
  paidAmount?: number;
  canConfirm: boolean;
};

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

/** Filas del calendario anual: 12 mensual, 4 trimestral, 0 anual/semanal. */
export function insuranceSchedulePeriodCount(cadence: string | undefined): number {
  const months = cadenceToMonths(cadence);
  if (months === 1) {
    return 12;
  }
  if (months === 3) {
    return 4;
  }
  return 0;
}

export function isAnnualInsuranceCadence(cadence: string | undefined): boolean {
  const months = cadenceToMonths(cadence);
  return months === 12;
}

export function showInsurancePaymentSchedule(cadence: string | undefined): boolean {
  return insuranceSchedulePeriodCount(cadence) > 0;
}

export function insurancePolicyYearBounds(
  meta: FleetInsurancePaymentMeta | undefined,
  today: Date = new Date(),
): { from: string; to: string } | null {
  const contract = meta?.insuranceContractDate?.trim();
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

function isInsurancePaymentExpense(e: Expense): boolean {
  const desc = (e.description ?? '').trim();
  return (
    e.kind === 'insurance' &&
    (desc.startsWith('Pago de póliza') || desc.startsWith('Contratación de póliza'))
  );
}

function expensePaidYmd(e: Expense): string {
  return expenseIncurredDateInput(e.incurredAt);
}

export function buildInsurancePaymentSchedule(params: {
  meta: FleetInsurancePaymentMeta | undefined;
  expenses: readonly Expense[];
  today?: Date;
}): InsuranceScheduleRow[] {
  const meta = params.meta;
  const cadenceMonths = cadenceToMonths(meta?.insurancePaymentCadence);
  const periodCount = insuranceSchedulePeriodCount(meta?.insurancePaymentCadence);
  const contract = meta?.insuranceContractDate?.trim();
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

  const paymentExpenses = params.expenses.filter(isInsurancePaymentExpense);
  const lastPaymentDate = meta?.insuranceLastPaymentDate?.trim();

  const rows: InsuranceScheduleRow[] = [];
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

    let status: InsuranceScheduleRowStatus;
    if (paid) {
      status = 'paid';
    } else if (due.getTime() < today.getTime()) {
      status = 'overdue';
    } else {
      const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
      status = daysUntil <= INSURANCE_PAYMENT_CONFIRM_WINDOW_DAYS ? 'due' : 'future';
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
      paidDate: matched ? expensePaidYmd(matched) : undefined,
      paidAmount: matched?.amount,
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

/** Vista compacta: pagados + próximo ciclo; un pendiente extra solo si el ciclo actual está por pagar o vencido. */
export function compactInsurancePaymentSchedule(
  rows: readonly InsuranceScheduleRow[],
): InsuranceScheduleRow[] {
  if (rows.length === 0) {
    return [];
  }

  const nextUnpaidIndex = rows.findIndex((row) => row.status !== 'paid');
  if (nextUnpaidIndex < 0) {
    const tail = Math.min(3, rows.length);
    return rows.slice(rows.length - tail);
  }

  const nextUnpaid = rows[nextUnpaidIndex]!;
  const includeTrailingPreview =
    nextUnpaid.status === 'due' || nextUnpaid.status === 'overdue';
  const lastVisibleIndex = includeTrailingPreview
    ? Math.min(rows.length - 1, nextUnpaidIndex + 1)
    : nextUnpaidIndex;

  return rows.slice(0, lastVisibleIndex + 1);
}

export function insuranceScheduleStatusLabel(status: InsuranceScheduleRowStatus): string {
  switch (status) {
    case 'paid':
      return 'Pagado';
    case 'due':
      return 'Por pagar';
    case 'overdue':
      return 'Vencido';
    default:
      return 'Pendiente';
  }
}

export type InsurancePaymentCompliance = {
  bucket: 'ok' | 'soon' | 'due';
  daysUntil: number | null;
};

/**
 * Estado de cumplimiento según el calendario anual (mensual/trimestral).
 * Prioriza el primer ciclo impago: vencido si algún ciclo anterior no está pagado.
 */
export function insurancePaymentCompliance(
  meta: FleetInsurancePaymentMeta | undefined,
  options?: { expenses?: readonly Expense[]; today?: Date },
): InsurancePaymentCompliance | null {
  if (!showInsurancePaymentSchedule(meta?.insurancePaymentCadence)) {
    return null;
  }
  const contract = meta?.insuranceContractDate?.trim();
  const policy = meta?.insurancePolicyNumber?.trim();
  if (!contract && !policy) {
    return null;
  }

  const rows = buildInsurancePaymentSchedule({
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
