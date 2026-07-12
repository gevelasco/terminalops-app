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

export function reportsCalendarMonthOptions(
  year: number,
  now = new Date(),
): Array<{ value: number; label: string }> {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const maxMonth = year >= currentYear ? currentMonth : 12;
  return Array.from({ length: maxMonth }, (_, index) => {
    const value = index + 1;
    return { value, label: reportsCalendarMonthLabel(value) };
  });
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

/** Rango inclusivo del mes calendario; mes en curso termina hoy. */
export function rangeForCalendarMonth(
  year: number,
  month: number,
  now = new Date(),
): { from: string; to: string } {
  const start = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isCurrentMonth =
    year === today.getFullYear() && month - 1 === today.getMonth();
  const end = isCurrentMonth ? today : lastDay;
  return { from: localYmd(start), to: localYmd(end) };
}

export function defaultReportsFilter(now = new Date()): ReportsFilter {
  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();
  const range = rangeForCalendarMonth(periodYear, periodMonth, now);
  return {
    periodMonth,
    periodYear,
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
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  switch (preset) {
    case 'today':
      start = new Date(end);
      break;
    case 'week':
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      break;
    case 'quarter': {
      const q = Math.floor(end.getMonth() / 3);
      start = new Date(end.getFullYear(), q * 3, 1);
      break;
    }
    case 'semester': {
      const half = end.getMonth() < 6 ? 0 : 6;
      start = new Date(end.getFullYear(), half, 1);
      break;
    }
    case 'year':
      start = new Date(end.getFullYear(), 0, 1);
      break;
    case 'month':
    default:
      start = new Date(end.getFullYear(), end.getMonth(), 1);
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
