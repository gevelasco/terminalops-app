import type { ToFilterTab } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import { rangeForPreset, parseYmd } from '@features/reports/utils/reports-filter';
import type { ReportsPeriodPreset } from '@features/reports/models/reports-view.models';

export type ExpensesPeriodPreset = ReportsPeriodPreset | 'all';

const PERIOD_TAB_ICONS = {
  today: 'periodToday',
  week: 'periodWeek',
  month: 'calendar',
  year: 'periodYear',
  all: 'grid',
} as const satisfies Partial<Record<ExpensesPeriodPreset, ToIconName>>;

export function expensesPeriodFilterTabs(): ReadonlyArray<
  ToFilterTab<ExpensesPeriodPreset>
> {
  return (
    [
      'today',
      'week',
      'month',
      'year',
      'all',
    ] as const
  ).map((id) => ({
    id,
    label: expensesPeriodLabel(id),
    icon: PERIOD_TAB_ICONS[id as keyof typeof PERIOD_TAB_ICONS] ?? 'grid',
  }));
}

export function expensesPeriodLabel(preset: ExpensesPeriodPreset): string {
  switch (preset) {
    case 'today':
      return 'Hoy';
    case 'week':
      return 'Semana';
    case 'month':
      return 'Mes';
    case 'semester':
      return 'Semestre';
    case 'year':
      return 'Año';
    case 'all':
      return 'Todo';
    default:
      return 'Todo';
  }
}

/** Rango inclusivo `from`/`to` (YYYY-MM-DD) o `null` para sin filtro de fecha. */
export function expensesRangeForPreset(
  preset: ExpensesPeriodPreset,
  now = new Date(),
): { from: string; to: string } | null {
  if (preset === 'all') {
    return null;
  }
  return rangeForPreset(preset, now);
}

/** Etiqueta legible del rango activo (p. ej. «1 mar – 17 jun 2026»). */
export function expensesPeriodRangeLabel(
  preset: ExpensesPeriodPreset,
  now = new Date(),
): string {
  if (preset === 'all') {
    return 'Todo el historial';
  }
  const range = expensesRangeForPreset(preset, now);
  if (!range) {
    return '';
  }
  const from = parseYmd(range.from);
  const to = parseYmd(range.to);
  if (!from || !to) {
    return '';
  }
  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: from.getFullYear() !== to.getFullYear() ? 'numeric' : undefined,
  });
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}
