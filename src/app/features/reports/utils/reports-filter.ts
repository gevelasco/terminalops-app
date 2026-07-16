import type { ReportsFilter, ReportsPeriodPreset } from '../models/reports-view.models';
import { localYmd } from '@shared/utils/local-ymd';

export { localYmd };

export function parseYmd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(t + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('es-MX', { month: 'long' });

export function reportsCalendarMonthLabel(month: number): string {
  const label = MONTH_LABEL_FORMAT.format(new Date(2024, month - 1, 1, 12));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function reportsCalendarYearOptions(
  now = new Date(),
  yearsBack = 10,
): number[] {
  const currentYear = now.getFullYear();
  const firstYear = Math.max(2020, currentYear - yearsBack);
  return Array.from(
    { length: currentYear - firstYear + 1 },
    (_, index) => currentYear - index,
  );
}

export function compareMonthYear(
  a: { month: number; year: number },
  b: { month: number; year: number },
): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  return a.month - b.month;
}

/** Primer día del mes de inicio → último día del mes de fin. */
export function rangeForMonthYearSpan(
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number,
  _now = new Date(),
): { from: string; to: string } {
  let startMonth = fromMonth;
  let startYear = fromYear;
  let endMonth = toMonth;
  let endYear = toYear;

  if (compareMonthYear({ month: startMonth, year: startYear }, { month: endMonth, year: endYear }) > 0) {
    startMonth = toMonth;
    startYear = toYear;
    endMonth = fromMonth;
    endYear = fromYear;
  }

  const start = new Date(startYear, startMonth - 1, 1);
  const lastDay = new Date(endYear, endMonth, 0);
  return { from: localYmd(start), to: localYmd(lastDay) };
}

/** @deprecated Prefer `rangeForMonthYearSpan` for reports ranges. */
export function rangeForCalendarMonth(
  year: number,
  month: number,
  now = new Date(),
): { from: string; to: string } {
  return rangeForMonthYearSpan(month, year, month, year, now);
}

export function defaultReportsFilter(now = new Date()): ReportsFilter {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const range = rangeForMonthYearSpan(month, year, month, year, now);
  return {
    fromMonth: month,
    fromYear: year,
    toMonth: month,
    toYear: year,
    from: range.from,
    to: range.to,
    clientPaymentMethods: [],
    clientIds: [],
  };
}

export function rangeForPreset(
  preset: ReportsPeriodPreset,
  now = new Date(),
): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  let end: Date;
  switch (preset) {
    case 'today':
      start = new Date(today);
      end = new Date(today);
      break;
    case 'week':
      start = new Date(today);
      start.setDate(start.getDate() - 6);
      end = new Date(today);
      break;
    case 'quarter': {
      const q = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), q * 3, 1);
      end = new Date(today.getFullYear(), q * 3 + 3, 0);
      break;
    }
    case 'semester': {
      const half = today.getMonth() < 6 ? 0 : 6;
      start = new Date(today.getFullYear(), half, 1);
      end = new Date(today.getFullYear(), half + 6, 0);
      break;
    }
    case 'year':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      break;
    case 'month':
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
  }
  return { from: localYmd(start), to: localYmd(end) };
}

export function previousPeriodRange(from: string, to: string): { from: string; to: string } {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) {
    return { from, to };
  }
  const days = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  const prevEnd = new Date(a);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return { from: localYmd(prevStart), to: localYmd(prevEnd) };
}

export function isoDayInRange(iso: string | undefined | null, from: string, to: string): boolean {
  const d = (iso ?? '').trim();
  if (!d) {
    return false;
  }
  const day = d.length >= 10 ? d.slice(0, 10) : d;
  return day >= from && day <= to;
}
