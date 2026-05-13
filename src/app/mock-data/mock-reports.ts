import { ReportSummaryRow } from '@shared/models/logistics.models';

export const MOCK_REPORT_ROWS: ReportSummaryRow[] = [
  { id: 'r1', metric: 'On-time arrivals', period: 'Apr 2026', value: '94%' },
  { id: 'r2', metric: 'Fleet utilization', period: 'Apr 2026', value: '78%' },
  { id: 'r3', metric: 'Cost per km', period: 'Apr 2026', value: '$12.40 MXN' },
];
