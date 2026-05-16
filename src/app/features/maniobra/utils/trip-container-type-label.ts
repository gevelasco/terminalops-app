import type { TripContainerType } from '@shared/models/logistics.models';

const LABELS: Record<TripContainerType, string> = {
  '20ft': '20 pies',
  '40ft': '40 pies',
  '40hc': '40 pies HC (High Cube)',
  na: 'N/A',
};

export function tripContainerTypeLabelMx(ct: TripContainerType | undefined): string {
  if (!ct) {
    return '—';
  }
  return LABELS[ct] ?? ct;
}
