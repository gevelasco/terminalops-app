import type { TripOperationType } from '@shared/models/logistics.models';

/** Misma lógica que `to-table` (`operationType`): badge por tipo de maniobra. */
export function tripOperationTypeBadgeClass(op: TripOperationType | unknown): string {
  const base = 'to-table-badge to-table-badge--op';
  switch (op as TripOperationType) {
    case 'sencillo':
      return `${base} to-table-badge--op-sencillo`;
    case 'full':
      return `${base} to-table-badge--op-full`;
    case 'plana':
      return `${base} to-table-badge--op-plana`;
    default:
      return `${base} to-table-badge--op-unknown`;
  }
}

export function tripOperationTypeBadgeLabel(op: TripOperationType | unknown): string {
  switch (op as TripOperationType) {
    case 'sencillo':
      return 'Sencillo';
    case 'full':
      return 'Full';
    case 'plana':
      return 'Plana';
    default:
      return '—';
  }
}
