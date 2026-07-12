import type {
  ExpenseCalendarItem,
  ExpenseCalendarProjectedRow,
} from '@core/services/api/expenses';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

const OPERATIONAL_TZ = 'America/Mexico_City';

const SCHEDULED_SOURCES = new Set([
  'insurance',
  'gps',
  'verification',
  'operator_payment',
]);

export interface DashboardUpcomingPaymentsRange {
  /** Hoy (MX); separa vencidos de próximos. */
  today: string;
  /** Último día del mes calendario actual (MX). */
  to: string;
  /** Inicio del rango para el API (incluye vencidos no pagados). */
  fetchFrom: string;
}

export interface DashboardUpcomingPaymentRow {
  id: string;
  source: string;
  /** Ej. «GPS — T-101», «Seguro — EQ-02», «Pago — Juan Pérez». */
  displayLabel: string;
  icon: ToIconName;
  amount: number;
  currency: string;
  dueYmd: string;
  dueLabel: string;
  overdue: boolean;
}

export function operationalTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function ymdMinusMonths(ymd: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return ymd;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1 - months,
    Number(match[3]),
    12,
    0,
    0,
    0,
  );
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Próximos: hoy → fin de mes. El API usa `fetchFrom` para incluir vencidos. */
export function dashboardUpcomingPaymentsRange(
  now = new Date(),
): DashboardUpcomingPaymentsRange {
  const today = operationalTodayYmd(now);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATIONAL_TZ,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 0);
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return {
    today,
    to,
    fetchFrom: ymdMinusMonths(today, 12),
  };
}

function trimLabel(value?: string): string {
  return value?.trim() ?? '';
}

function paymentSubjectLabel(projected: ExpenseCalendarProjectedRow): string {
  switch (projected.source) {
    case 'gps':
      return (
        trimLabel(projected.relatedUnitLabel) ||
        trimLabel(projected.fleetRelationLabel)
      );
    case 'insurance':
    case 'verification':
      return (
        trimLabel(projected.relatedUnitLabel) ||
        trimLabel(projected.relatedEquipmentLabel) ||
        trimLabel(projected.fleetRelationLabel)
      );
    case 'operator_payment':
      return trimLabel(projected.relatedOperatorLabel);
    default:
      return trimLabel(projected.fleetRelationLabel);
  }
}

function upcomingPaymentDisplayLabel(projected: ExpenseCalendarProjectedRow): string {
  const subject = paymentSubjectLabel(projected);
  const prefix = (() => {
    switch (projected.source) {
      case 'gps':
        return 'GPS';
      case 'insurance':
        return 'Seguro';
      case 'verification':
        return 'Verificación';
      case 'operator_payment':
        return 'Pago';
      default:
        return paymentTypeMeta(projected.source).typeLabel;
    }
  })();
  return subject ? `${prefix} - ${subject}` : prefix;
}

function paymentTypeMeta(source: string): { typeLabel: string; icon: ToIconName } {
  switch (source) {
    case 'insurance':
      return { typeLabel: 'Seguro', icon: 'document' };
    case 'gps':
      return { typeLabel: 'GPS', icon: 'tracking' };
    case 'verification':
      return { typeLabel: 'Verificación', icon: 'maintenance' };
    case 'operator_payment':
      return { typeLabel: 'Pago operador', icon: 'person' };
    default:
      return { typeLabel: 'Pago', icon: 'settlement' };
  }
}

function formatDueLabel(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return ymd;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0,
  );
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function parseAmount(raw: string | number): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

export function buildDashboardUpcomingPayments(
  items: readonly ExpenseCalendarItem[],
  range = dashboardUpcomingPaymentsRange(),
): DashboardUpcomingPaymentRow[] {
  const rows: DashboardUpcomingPaymentRow[] = [];

  for (const item of items) {
    if (item.entryType !== 'projected') {
      continue;
    }
    const projected = item.projected;
    if (!projected || projected.nature !== 'scheduled') {
      continue;
    }
    if (!SCHEDULED_SOURCES.has(projected.source)) {
      continue;
    }
    const dueYmd = (projected.dueDate || item.dateYmd || '').trim();
    if (!dueYmd) {
      continue;
    }
    const overdue = dueYmd < range.today;
    const upcoming = dueYmd >= range.today && dueYmd <= range.to;
    if (!overdue && !upcoming) {
      continue;
    }
    const { icon } = paymentTypeMeta(projected.source);
    const dueLabel = overdue
      ? `Vencido · ${formatDueLabel(dueYmd)}`
      : formatDueLabel(dueYmd);
    rows.push({
      id: item.id,
      source: projected.source,
      displayLabel: upcomingPaymentDisplayLabel(projected),
      icon,
      amount: parseAmount(item.amount),
      currency: item.currency || 'MXN',
      dueYmd,
      dueLabel,
      overdue,
    });
  }

  rows.sort(
    (a, b) =>
      a.dueYmd.localeCompare(b.dueYmd) ||
      a.displayLabel.localeCompare(b.displayLabel, 'es'),
  );
  return rows;
}
