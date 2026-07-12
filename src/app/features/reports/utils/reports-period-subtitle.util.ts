import type { ReportsFilter } from '../models/reports-view.models';
import { parseYmd } from './reports-filter';

export function reportsPeriodSubtitle(filter: ReportsFilter): string {
  const a = parseYmd(filter.from);
  const b = parseYmd(filter.to);
  if (!a || !b) {
    return '';
  }
  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: a.getFullYear() !== b.getFullYear() ? 'numeric' : undefined,
  });
  return `${fmt.format(a)} – ${fmt.format(b)}`;
}
