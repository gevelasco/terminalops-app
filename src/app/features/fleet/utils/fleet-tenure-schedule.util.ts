import type { Expense } from '@shared/models/logistics.models';
import { expenseIncurredDateInput } from '@features/expenses/utils/expenses-form.util';
import { cadenceToMonths } from './fleet-insurance-payment.util';
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

export type TenureScheduleRow = InsuranceScheduleRow;

export {
  compactInsurancePaymentSchedule as compactTenurePaymentSchedule,
  insuranceScheduleStatusLabel as tenureScheduleStatusLabel,
};

export type FleetTenurePaymentMeta = {
  trailerRecurringPaymentDate?: string;
  trailerRecurringPaymentCadence?: string;
  trailerRecurringInstallmentCount?: number;
  trailerRecurringPaymentAmount?: number;
  trailerRecurringLastPaymentDate?: string;
};

const TENURE_PAYMENT_CONFIRM_WINDOW_DAYS = 10;

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

function scheduleLabel(index: number, cadenceMonths: number): string {
  if (cadenceMonths === 1) return `Mes ${index}`;
  if (cadenceMonths === 3) return `T${index}`;
  return `Pago ${index}`;
}

function isTenurePaymentExpense(e: Expense): boolean {
  const desc = (e.description ?? '').trim();
  return e.kind === 'tenure_payment' && desc.startsWith('Cuota de financiamiento');
}

function expensePaidYmd(e: Expense): string {
  if (e.paidAt) {
    return expenseIncurredDateInput(e.paidAt);
  }
  return expenseIncurredDateInput(e.incurredAt);
}

export function tenureSchedulePeriodCount(meta: FleetTenurePaymentMeta | undefined): number {
  if (!meta) return 0;
  const cadenceMonths = cadenceToMonths(meta.trailerRecurringPaymentCadence);
  const totalInstallments = meta.trailerRecurringInstallmentCount;
  if (!totalInstallments || totalInstallments <= 0 || cadenceMonths === 0) return 0;
  return totalInstallments;
}

export function showTenurePaymentSchedule(meta: FleetTenurePaymentMeta | undefined): boolean {
  if (!meta) return false;
  const cadenceMonths = cadenceToMonths(meta.trailerRecurringPaymentCadence);
  if (cadenceMonths === 0) return false;
  const count = meta.trailerRecurringInstallmentCount;
  if (!count || count <= 0) return false;
  const date = meta.trailerRecurringPaymentDate?.trim();
  return !!date;
}

export function tenurePaymentBounds(
  meta: FleetTenurePaymentMeta | undefined,
): { from: string; to: string } | null {
  if (!meta) return null;
  const startDate = meta.trailerRecurringPaymentDate?.trim();
  if (!startDate) return null;
  const parsed = parseYmd(startDate);
  if (!parsed) return null;
  const totalInstallments = meta.trailerRecurringInstallmentCount ?? 0;
  const cadenceMonths = cadenceToMonths(meta.trailerRecurringPaymentCadence);
  if (cadenceMonths === 0 || totalInstallments <= 0) return null;

  const from = new Date(parsed.getTime());
  from.setMonth(from.getMonth() - 2);
  const end = addMonths(parsed, totalInstallments * cadenceMonths);
  end.setMonth(end.getMonth() + 2);
  return { from: formatYmd(from), to: formatYmd(end) };
}

export function buildTenurePaymentSchedule(params: {
  meta: FleetTenurePaymentMeta | undefined;
  expenses: readonly Expense[];
  today?: Date;
}): TenureScheduleRow[] {
  const meta = params.meta;
  if (!meta) return [];
  const cadenceMonths = cadenceToMonths(meta.trailerRecurringPaymentCadence);
  const totalInstallments = meta.trailerRecurringInstallmentCount ?? 0;
  const startDateStr = meta.trailerRecurringPaymentDate?.trim();

  if (!startDateStr || cadenceMonths === 0 || totalInstallments <= 0) return [];

  const startDate = parseYmd(startDateStr);
  if (!startDate) return [];

  const today = startOfToday(params.today ?? new Date());
  const paymentExpenses = params.expenses.filter(isTenurePaymentExpense);
  const lastPaymentDate = meta.trailerRecurringLastPaymentDate?.trim();

  const rows: TenureScheduleRow[] = [];
  let nextUnpaidIndex = -1;

  for (let i = 0; i < totalInstallments; i += 1) {
    const due = addMonths(startDate, i * cadenceMonths);
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
      status = daysUntil <= TENURE_PAYMENT_CONFIRM_WINDOW_DAYS ? 'due' : 'future';
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
