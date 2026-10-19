import type { Expense } from '@shared/models/logistics.models';
import { cadenceToMonths } from './fleet-insurance-payment.util';
import {
  compactInsurancePaymentSchedule,
  insuranceScheduleStatusLabel,
  type InsuranceScheduleRow,
} from './fleet-insurance-schedule.util';
import {
  buildLedgerCoverageSchedule,
  type LedgerCoverageScheduleRow,
} from './fleet-ledger-coverage-schedule.util';

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

function tenureScheduleLabel(index: number, cadenceMonths: number): string {
  if (cadenceMonths === 1) {
    return `Mes ${index}`;
  }
  if (cadenceMonths === 3) {
    return `T${index}`;
  }
  return `Pago ${index}`;
}

/** Re-etiqueta por orden de vencimiento (1…N), no por “Mensualidad k/12” del seguro. */
function relabelTenureScheduleRows(
  rows: readonly LedgerCoverageScheduleRow[],
  cadenceMonths: number,
): TenureScheduleRow[] {
  return rows.map((row, i) => {
    const index = i + 1;
    return {
      ...row,
      index,
      label: tenureScheduleLabel(index, cadenceMonths),
    };
  });
}

export function buildTenurePaymentSchedule(params: {
  meta: FleetTenurePaymentMeta | undefined;
  expenses: readonly Expense[];
  today?: Date;
}): TenureScheduleRow[] {
  if (!showTenurePaymentSchedule(params.meta)) {
    return [];
  }
  const cadenceMonths = cadenceToMonths(params.meta?.trailerRecurringPaymentCadence);
  const rows = buildLedgerCoverageSchedule({
    expenses: params.expenses,
    isMatch: (expense) => expense.kind === 'tenure_payment',
    cadenceMonths,
    confirmWindowDays: TENURE_PAYMENT_CONFIRM_WINDOW_DAYS,
    today: params.today,
  });
  return relabelTenureScheduleRows(rows, cadenceMonths);
}
