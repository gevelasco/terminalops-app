import { parseYmd } from '@features/reports/utils/reports-filter';
import {
  buildExpensesCalendarWeeks,
  expensesCalendarWeekdayLabels,
  type ExpensesCalendarWeekRow,
} from '@features/expenses/utils/expenses-calendar.util';
import type {
  ReportsBalanceDailyActivityDay,
  ReportsBalanceDailyActivityEvent,
} from '@shared/models/api/api-reports-balance.model';

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
  events: readonly ReportsBalanceDailyActivityEvent[];
}

export interface ReportsBalanceActivityHeatmapMonthCell {
  monthKey: string;
  label: string;
  incomeCount: number;
  expenseCount: number;
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

export function buildReportsBalanceActivityHeatmapModel(
  dailyActivity: readonly ReportsBalanceDailyActivityDay[],
  from: string,
  to: string,
): ReportsBalanceActivityHeatmapModel {
  const indexed = indexDailyActivity(dailyActivity);
  const weekdayLabels = expensesCalendarWeekdayLabels();

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
      (cell) => cell.inRange && cell.incomeCount + cell.expenseCount > 0,
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
  const expenses = events.filter((event) => event.kind === 'expense');
  const lines: string[] = [dateLabel];

  if (income.length > 0) {
    lines.push('Ingresos:');
    for (const event of income) {
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

/** Azul explícito para ingresos (no usar `--to-color-primary`, suele ser grisáceo). */
export const REPORTS_BALANCE_ACTIVITY_HEAT_INCOME = '#2563eb';

/** Gris explícito para gastos. */
export const REPORTS_BALANCE_ACTIVITY_HEAT_EXPENSE = '#64748b';

export interface ReportsBalanceActivityHeatIntensityBounds {
  maxIncome: number;
  maxExpense: number;
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

export function computeReportsBalanceActivityIntensityBounds(
  model: ReportsBalanceActivityHeatmapModel,
): ReportsBalanceActivityHeatIntensityBounds {
  let maxIncome = 0;
  let maxExpense = 0;

  for (const cell of model.dayCells) {
    if (!cell.inRange) {
      continue;
    }
    maxIncome = Math.max(maxIncome, cell.incomeCount);
    maxExpense = Math.max(maxExpense, cell.expenseCount);
  }

  for (const cell of model.monthCells) {
    maxIncome = Math.max(maxIncome, cell.incomeCount);
    maxExpense = Math.max(maxExpense, cell.expenseCount);
  }

  return {
    maxIncome: Math.max(maxIncome, 1),
    maxExpense: Math.max(maxExpense, 1),
  };
}

export function buildReportsBalanceActivityCellStyle(
  incomeCount: number,
  expenseCount: number,
  bounds: ReportsBalanceActivityHeatIntensityBounds,
): ReportsBalanceActivityHeatCellStyle | null {
  if (incomeCount <= 0 && expenseCount <= 0) {
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
  const incomeColor = reportsBalanceActivityIncomeColor(incomeIntensity);
  const expenseColor = reportsBalanceActivityExpenseColor(expenseIntensity);
  const peakIntensity = Math.max(incomeIntensity, expenseIntensity);

  if (incomeCount > 0 && expenseCount > 0) {
    const dominant =
      incomeIntensity >= expenseIntensity
        ? REPORTS_BALANCE_ACTIVITY_HEAT_INCOME
        : REPORTS_BALANCE_ACTIVITY_HEAT_EXPENSE;
    return {
      background: `linear-gradient(135deg, ${incomeColor} 0 50%, ${expenseColor} 50% 100%)`,
      borderColor: mixHexWithWhite(dominant, 0.78 - peakIntensity * 0.42),
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
