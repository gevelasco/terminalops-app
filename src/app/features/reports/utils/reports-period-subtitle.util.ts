import type { ReportsFilter } from '../models/reports-view.models';
import { reportsCalendarMonthLabel } from './reports-filter';

export function reportsPeriodSubtitle(filter: ReportsFilter): string {
  const sameMonth =
    filter.fromMonth === filter.toMonth && filter.fromYear === filter.toYear;
  if (sameMonth) {
    return `${reportsCalendarMonthLabel(filter.fromMonth)} ${filter.fromYear}`;
  }
  const fromLabel = `${reportsCalendarMonthLabel(filter.fromMonth)} ${filter.fromYear}`;
  const toLabel = `${reportsCalendarMonthLabel(filter.toMonth)} ${filter.toYear}`;
  return `${fromLabel} – ${toLabel}`;
}
