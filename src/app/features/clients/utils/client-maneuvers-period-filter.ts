import type { ReportsPeriodPreset } from '@features/reports/models/reports-view.models';
import {
  parseYmd,
  rangeForPreset,
} from '@features/reports/utils/reports-filter';
import type { ToFilterTab } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

export type ClientManeuversPeriodPreset = Extract<
  ReportsPeriodPreset,
  'month' | 'semester' | 'year'
>;

const PERIOD_TAB_ICONS = {
  month: 'calendar',
  semester: 'periodRange',
  year: 'periodYear',
} as const satisfies Record<ClientManeuversPeriodPreset, ToIconName>;

const PERIOD_LABELS: Record<ClientManeuversPeriodPreset, string> = {
  month: 'Mes',
  semester: 'Semestre',
  year: 'Año',
};

export function clientManeuversPeriodFilterTabs(): ReadonlyArray<
  ToFilterTab<ClientManeuversPeriodPreset>
> {
  return (['month', 'semester', 'year'] as const).map((id) => ({
    id,
    label: PERIOD_LABELS[id],
    icon: PERIOD_TAB_ICONS[id],
  }));
}

export function clientManeuversRangeForPreset(
  preset: ClientManeuversPeriodPreset,
  now = new Date(),
): { from: string; to: string } {
  return rangeForPreset(preset, now);
}

export function clientManeuversPeriodRangeLabel(
  preset: ClientManeuversPeriodPreset,
  now = new Date(),
): string {
  const range = clientManeuversRangeForPreset(preset, now);
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
