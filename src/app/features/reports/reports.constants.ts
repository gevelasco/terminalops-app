import type { ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import type { ReportsTabId } from './models/reports-view.models';

export type ReportsToolbarTab = ToSegmentTab<ReportsTabId>;

export const REPORTS_TAB_DEFINITIONS: readonly ReportsToolbarTab[] = [
  { id: 'general', label: 'General', icon: 'chartBar' },
  { id: 'balance', label: 'Balance', icon: 'revenue' },
  { id: 'maniobras', label: 'Maniobras', icon: 'route' },
  { id: 'fleet', label: 'Flota', icon: 'truck' },
] as const;

export const REPORTS_FINANCIAL_TAB_IDS = new Set<ReportsTabId>(['general', 'balance']);
