import { localYmd } from '@shared/utils/local-ymd';

export interface ExpensesCalendarDayCell {
  ymd: string;
  day: number;
  inMonth: boolean;
}

export interface ExpensesCalendarWeekRow {
  days: ExpensesCalendarDayCell[];
}

const WEEKDAY_LABELS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'] as const;

export function expensesCalendarWeekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS_ES;
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

export function normalizeExpenseDateRange(
  from: string,
  to: string,
): { from: string; to: string } {
  return compareYmd(from, to) <= 0 ? { from, to } : { from: to, to: from };
}

export function isYmdInRange(
  ymd: string,
  from: string | null,
  to: string | null,
): boolean {
  if (!from || !to) {
    return false;
  }
  const range = normalizeExpenseDateRange(from, to);
  return compareYmd(ymd, range.from) >= 0 && compareYmd(ymd, range.to) <= 0;
}

export function isYmdRangeEndpoint(
  ymd: string,
  from: string | null,
  to: string | null,
): boolean {
  if (!from) {
    return false;
  }
  if (!to) {
    return ymd === from;
  }
  const range = normalizeExpenseDateRange(from, to);
  return ymd === range.from || ymd === range.to;
}

export function formatExpenseCalendarMonthTitle(viewMonth: Date): string {
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(viewMonth);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatExpenseCalendarRangeLabel(
  from: string | null,
  to: string | null,
): string {
  if (!from) {
    return 'Selecciona un rango de fechas en el calendario';
  }
  const parse = (ymd: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) {
      return null;
    }
    const d = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const endYmd = to ?? from;
  const range = normalizeExpenseDateRange(from, endYmd);
  const startDate = parse(range.from);
  const endDate = parse(range.to);
  if (!startDate || !endDate) {
    return 'Selecciona un rango de fechas en el calendario';
  }
  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year:
      startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined,
  });
  if (range.from === range.to) {
    return fmt.format(startDate);
  }
  return `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
}

export function buildExpensesCalendarWeeks(
  viewMonth: Date,
): ExpensesCalendarWeekRow[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1, 12);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset, 12);
  const weeks: ExpensesCalendarWeekRow[] = [];

  for (let week = 0; week < 6; week++) {
    const days: ExpensesCalendarDayCell[] = [];
    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + week * 7 + day,
        12,
      );
      days.push({
        ymd: localYmd(cellDate),
        day: cellDate.getDate(),
        inMonth: cellDate.getMonth() === month,
      });
    }
    weeks.push({ days });
  }

  return weeks;
}

export function shiftCalendarMonth(viewMonth: Date, delta: number): Date {
  return new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1, 12);
}

export function defaultExpenseCalendarRange(now = new Date()): {
  from: string;
  to: string;
} {
  const from = localYmd(new Date(now.getFullYear(), now.getMonth(), 1, 12));
  const to = localYmd(now);
  return { from, to };
}

/** Rango listo para consultar gastos (`from`/`to` inclusivos). */
export function resolveExpenseCalendarQueryRange(
  from: string | null,
  to: string | null,
): { from: string; to: string } | null {
  if (!from?.trim() || !to?.trim()) {
    return null;
  }
  return normalizeExpenseDateRange(from.trim(), to.trim());
}
