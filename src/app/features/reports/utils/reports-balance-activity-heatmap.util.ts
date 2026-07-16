import { parseYmd } from '@features/reports/utils/reports-filter';
import {
  buildExpensesCalendarWeeks,
  expensesCalendarWeekdayLabels,
  type ExpensesCalendarWeekRow,
} from '@features/expenses/utils/expenses-calendar.util';
import { STITCH_PALETTE } from '@features/dashboard/utils/dashboard-chart-colors';
import type {
  ReportsBalanceDailyActivityDay,
  ReportsBalanceDailyActivityEvent,
} from '@shared/models/api/api-reports-balance.model';
import { localYmd } from '@shared/utils/local-ymd';

export type ReportsBalanceActivityHeatmapLayout =
  | 'day'
  | 'week'
  | 'month'
  | 'months';

export interface ReportsBalanceActivityHeatmapCell {
  date: string;
  day: number;
  inRange: boolean;
  inMonth: boolean;
  incomeCount: number;
  expenseCount: number;
  receivableCount: number;
  payableCount: number;
  events: readonly ReportsBalanceDailyActivityEvent[];
}

export interface ReportsBalanceActivityHeatmapMonthCell {
  monthKey: string;
  label: string;
  incomeCount: number;
  expenseCount: number;
  receivableCount: number;
  payableCount: number;
  events: readonly ReportsBalanceDailyActivityEvent[];
}

export interface ReportsBalanceActivityHeatmapModel {
  layout: ReportsBalanceActivityHeatmapLayout;
  title: string;
  weekdayLabels: readonly string[];
  weeks: ExpensesCalendarWeekRow[];
  dayCells: ReportsBalanceActivityHeatmapCell[];
  monthCells: ReportsBalanceActivityHeatmapMonthCell[];
  hasActivity: boolean;
}

function indexDailyActivity(
  rows: readonly ReportsBalanceDailyActivityDay[],
): Map<string, ReportsBalanceDailyActivityDay> {
  return new Map(rows.map((row) => [row.date, row]));
}

function cellFromDay(
  ymd: string,
  day: number,
  inRange: boolean,
  inMonth: boolean,
  indexed: Map<string, ReportsBalanceDailyActivityDay>,
): ReportsBalanceActivityHeatmapCell {
  const row = indexed.get(ymd);
  return {
    date: ymd,
    day,
    inRange,
    inMonth,
    incomeCount: row?.incomeCount ?? 0,
    expenseCount: row?.expenseCount ?? 0,
    receivableCount: row?.receivableCount ?? 0,
    payableCount: row?.payableCount ?? 0,
    events: row?.events ?? [],
  };
}

function isYmdInRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

function monthTitle(from: string): string {
  const date = parseYmd(from);
  if (!date) {
    return '';
  }
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function enumerateDays(from: string, to: string): string[] {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (!start || !end) {
    return [];
  }
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    days.push(localYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map((v) => Number(v));
  if (!y || !m) {
    return monthKey;
  }
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1, 12));
  return label.replace('.', '');
}

function buildMonthCells(
  from: string,
  to: string,
  indexed: Map<string, ReportsBalanceDailyActivityDay>,
): ReportsBalanceActivityHeatmapMonthCell[] {
  const byMonth = new Map<string, ReportsBalanceActivityHeatmapMonthCell>();

  for (const ymd of enumerateDays(from, to)) {
    const monthKey = monthKeyFromYmd(ymd);
    const row = indexed.get(ymd);
    if (!row) {
      continue;
    }
    let bucket = byMonth.get(monthKey);
    if (!bucket) {
      bucket = {
        monthKey,
        label: monthLabelFromKey(monthKey),
        incomeCount: 0,
        expenseCount: 0,
        receivableCount: 0,
        payableCount: 0,
        events: [],
      };
      byMonth.set(monthKey, bucket);
    }
    bucket.incomeCount += row.incomeCount;
    bucket.expenseCount += row.expenseCount;
    bucket.receivableCount += row.receivableCount;
    bucket.payableCount += row.payableCount;
    bucket.events = [...bucket.events, ...row.events];
  }

  const monthKeys = [...new Set(enumerateDays(from, to).map(monthKeyFromYmd))];
  return monthKeys.map(
    (monthKey) =>
      byMonth.get(monthKey) ?? {
        monthKey,
        label: monthLabelFromKey(monthKey),
        incomeCount: 0,
        expenseCount: 0,
        receivableCount: 0,
        payableCount: 0,
        events: [],
      },
  );
}

function isSameCalendarMonth(from: string, to: string): boolean {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) {
    return true;
  }
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function buildReportsBalanceActivityHeatmapModel(
  dailyActivity: readonly ReportsBalanceDailyActivityDay[],
  from: string,
  to: string,
): ReportsBalanceActivityHeatmapModel {
  const indexed = indexDailyActivity(dailyActivity);
  const weekdayLabels = expensesCalendarWeekdayLabels();

  if (!isSameCalendarMonth(from, to)) {
    const monthCells = buildMonthCells(from, to, indexed);
    return {
      layout: 'months',
      title: 'Por mes',
      weekdayLabels,
      weeks: [],
      dayCells: [],
      monthCells,
      hasActivity: monthCells.some((cell) => cell.incomeCount + cell.expenseCount + cell.receivableCount > 0),
    };
  }

  const anchor = parseYmd(from) ?? new Date();
  const weeks = buildExpensesCalendarWeeks(anchor);
  const dayCells: ReportsBalanceActivityHeatmapCell[] = [];

  for (const week of weeks) {
    for (const cell of week.days) {
      dayCells.push(
        cellFromDay(
          cell.ymd,
          cell.day,
          isYmdInRange(cell.ymd, from, to),
          cell.inMonth,
          indexed,
        ),
      );
    }
  }

  return {
    layout: 'month',
    title: monthTitle(from),
    weekdayLabels,
    weeks,
    dayCells,
    monthCells: [],
    hasActivity: dayCells.some(
      (cell) => cell.inRange && cell.incomeCount + cell.expenseCount + cell.receivableCount > 0,
    ),
  };
}

export function formatReportsBalanceActivityTooltip(
  dateLabel: string,
  events: readonly ReportsBalanceDailyActivityEvent[],
  formatMoney: (value: number) => string,
): string {
  if (events.length === 0) {
    return `${dateLabel}\nSin movimiento`;
  }

  const income = events.filter((event) => event.kind === 'income');
  const receivables = events.filter((event) => event.kind === 'receivable');
  const payables = events.filter((event) => event.kind === 'payable');
  const expenses = events.filter((event) => event.kind === 'expense');
  const lines: string[] = [dateLabel];

  if (income.length > 0) {
    lines.push('Ingresos:');
    for (const event of income) {
      lines.push(`· ${event.label} — ${formatMoney(event.amount)}`);
    }
  }

  if (receivables.length > 0) {
    lines.push('Por cobrar:');
    for (const event of receivables) {
      lines.push(`· ${event.label} — ${formatMoney(event.amount)}`);
    }
  }

  if (payables.length > 0) {
    lines.push('Por pagar:');
    for (const event of payables) {
      lines.push(`· ${event.label} — ${formatMoney(event.amount)}`);
    }
  }

  if (expenses.length > 0) {
    lines.push('Gastos:');
    for (const event of expenses) {
      lines.push(`· ${event.label} — ${formatMoney(event.amount)}`);
    }
  }

  return lines.join('\n');
}

/** Ingresos cobrados — color 1. */
export const REPORTS_BALANCE_ACTIVITY_HEAT_INCOME = STITCH_PALETTE[0];

/** Cobros por cobrar — color 2. */
export const REPORTS_BALANCE_ACTIVITY_HEAT_RECEIVABLE = STITCH_PALETTE[1];

/** Cuentas por pagar — color 3. */
export const REPORTS_BALANCE_ACTIVITY_HEAT_PAYABLE = STITCH_PALETTE[2];

/** Gastos confirmados — color 4. */
export const REPORTS_BALANCE_ACTIVITY_HEAT_EXPENSE = STITCH_PALETTE[3];

export interface ReportsBalanceActivityHeatIntensityBounds {
  maxIncome: number;
  maxExpense: number;
  maxReceivable: number;
  maxPayable: number;
}

export interface ReportsBalanceActivityHeatCellStyle {
  background: string;
  borderColor: string;
  hot: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mixHexWithWhite(hex: string, whiteRatio: number): string {
  const ratio = Math.max(0, Math.min(1, whiteRatio));
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Intensidad 0–1; más movimientos ⇒ color más fuerte (arranque muy suave). */
export function reportsBalanceActivityHeatIntensity(count: number, max: number): number {
  if (count <= 0) {
    return 0;
  }
  const normalized = count / Math.max(max, 1);
  return Math.max(0.05, Math.min(1, Math.pow(normalized, 0.75)));
}

function reportsBalanceActivityHeatColorStrength(intensity: number): number {
  return Math.pow(intensity, 1.85);
}

export function reportsBalanceActivityIncomeColor(intensity: number): string {
  const colorStrength = reportsBalanceActivityHeatColorStrength(intensity);
  const whiteMix = 1 - colorStrength * 0.68;
  return mixHexWithWhite(REPORTS_BALANCE_ACTIVITY_HEAT_INCOME, whiteMix);
}

export function reportsBalanceActivityExpenseColor(intensity: number): string {
  const colorStrength = reportsBalanceActivityHeatColorStrength(intensity);
  const whiteMix = 1 - colorStrength * 0.68;
  return mixHexWithWhite(REPORTS_BALANCE_ACTIVITY_HEAT_EXPENSE, whiteMix);
}

export function reportsBalanceActivityReceivableColor(intensity: number): string {
  const colorStrength = reportsBalanceActivityHeatColorStrength(intensity);
  const whiteMix = 1 - colorStrength * 0.68;
  return mixHexWithWhite(REPORTS_BALANCE_ACTIVITY_HEAT_RECEIVABLE, whiteMix);
}

export function reportsBalanceActivityPayableColor(intensity: number): string {
  const colorStrength = reportsBalanceActivityHeatColorStrength(intensity);
  const whiteMix = 1 - colorStrength * 0.68;
  return mixHexWithWhite(REPORTS_BALANCE_ACTIVITY_HEAT_PAYABLE, whiteMix);
}

export function computeReportsBalanceActivityIntensityBounds(
  model: ReportsBalanceActivityHeatmapModel,
): ReportsBalanceActivityHeatIntensityBounds {
  let maxIncome = 0;
  let maxExpense = 0;
  let maxReceivable = 0;
  let maxPayable = 0;

  for (const cell of model.dayCells) {
    if (!cell.inRange) continue;
    maxIncome = Math.max(maxIncome, cell.incomeCount);
    maxExpense = Math.max(maxExpense, cell.expenseCount);
    maxReceivable = Math.max(maxReceivable, cell.receivableCount);
    maxPayable = Math.max(maxPayable, cell.payableCount);
  }

  for (const cell of model.monthCells) {
    maxIncome = Math.max(maxIncome, cell.incomeCount);
    maxExpense = Math.max(maxExpense, cell.expenseCount);
    maxReceivable = Math.max(maxReceivable, cell.receivableCount);
    maxPayable = Math.max(maxPayable, cell.payableCount);
  }

  return {
    maxIncome: Math.max(maxIncome, 1),
    maxExpense: Math.max(maxExpense, 1),
    maxReceivable: Math.max(maxReceivable, 1),
    maxPayable: Math.max(maxPayable, 1),
  };
}

export function buildReportsBalanceActivityCellStyle(
  incomeCount: number,
  expenseCount: number,
  bounds: ReportsBalanceActivityHeatIntensityBounds,
  receivableCount = 0,
  payableCount = 0,
): ReportsBalanceActivityHeatCellStyle | null {
  if (incomeCount <= 0 && expenseCount <= 0 && receivableCount <= 0 && payableCount <= 0) {
    return null;
  }

  const incomeIntensity =
    incomeCount > 0
      ? reportsBalanceActivityHeatIntensity(incomeCount, bounds.maxIncome)
      : 0;
  const expenseIntensity =
    expenseCount > 0
      ? reportsBalanceActivityHeatIntensity(expenseCount, bounds.maxExpense)
      : 0;
  const receivableIntensity =
    receivableCount > 0
      ? reportsBalanceActivityHeatIntensity(receivableCount, bounds.maxReceivable)
      : 0;
  const payableIntensity =
    payableCount > 0
      ? reportsBalanceActivityHeatIntensity(payableCount, bounds.maxPayable)
      : 0;
  const incomeColor = reportsBalanceActivityIncomeColor(incomeIntensity);
  const expenseColor = reportsBalanceActivityExpenseColor(expenseIntensity);
  const receivableColor = reportsBalanceActivityReceivableColor(receivableIntensity);
  const payableColor = reportsBalanceActivityPayableColor(payableIntensity);
  const peakIntensity = Math.max(incomeIntensity, expenseIntensity, receivableIntensity, payableIntensity);

  const activeKinds = [
    incomeCount > 0 ? 'income' : null,
    receivableCount > 0 ? 'receivable' : null,
    expenseCount > 0 ? 'expense' : null,
    payableCount > 0 ? 'payable' : null,
  ].filter(Boolean) as string[];

  if (activeKinds.length >= 2) {
    const colors: string[] = [];
    if (incomeCount > 0) colors.push(incomeColor);
    if (receivableCount > 0) colors.push(receivableColor);
    if (payableCount > 0) colors.push(payableColor);
    if (expenseCount > 0) colors.push(expenseColor);
    const sliceSize = 100 / colors.length;
    const stops = colors
      .map((c, i) => `${c} ${Math.round(sliceSize * i)}% ${Math.round(sliceSize * (i + 1))}%`)
      .join(', ');
    const intensities = [
      { hex: REPORTS_BALANCE_ACTIVITY_HEAT_INCOME, val: incomeIntensity },
      { hex: REPORTS_BALANCE_ACTIVITY_HEAT_RECEIVABLE, val: receivableIntensity },
      { hex: REPORTS_BALANCE_ACTIVITY_HEAT_PAYABLE, val: payableIntensity },
      { hex: REPORTS_BALANCE_ACTIVITY_HEAT_EXPENSE, val: expenseIntensity },
    ];
    const dominantHex = intensities.reduce((a, b) => (b.val > a.val ? b : a)).hex;
    return {
      background: `linear-gradient(135deg, ${stops})`,
      borderColor: mixHexWithWhite(dominantHex, 0.78 - peakIntensity * 0.42),
      hot: peakIntensity >= 0.78,
    };
  }

  if (incomeCount > 0) {
    return {
      background: incomeColor,
      borderColor: mixHexWithWhite(
        REPORTS_BALANCE_ACTIVITY_HEAT_INCOME,
        0.8 - incomeIntensity * 0.45,
      ),
      hot: incomeIntensity >= 0.78,
    };
  }

  if (receivableCount > 0) {
    return {
      background: receivableColor,
      borderColor: mixHexWithWhite(
        REPORTS_BALANCE_ACTIVITY_HEAT_RECEIVABLE,
        0.8 - receivableIntensity * 0.45,
      ),
      hot: receivableIntensity >= 0.78,
    };
  }

  if (payableCount > 0) {
    return {
      background: payableColor,
      borderColor: mixHexWithWhite(
        REPORTS_BALANCE_ACTIVITY_HEAT_PAYABLE,
        0.8 - payableIntensity * 0.45,
      ),
      hot: payableIntensity >= 0.78,
    };
  }

  return {
    background: expenseColor,
    borderColor: mixHexWithWhite(
      REPORTS_BALANCE_ACTIVITY_HEAT_EXPENSE,
      0.8 - expenseIntensity * 0.45,
    ),
    hot: expenseIntensity >= 0.78,
  };
}

export function formatReportsBalanceActivityDayLabel(ymd: string): string {
  const date = parseYmd(ymd);
  if (!date) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '');
}
