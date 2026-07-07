import type { Operator, OperatorOperationalStatus } from '@shared/models/logistics.models';

/** Orden fijo de listado: en curso → programado → disponible → resto del catálogo. */
export const OPERATOR_OPERATIONAL_STATUS_DISPLAY_ORDER: readonly OperatorOperationalStatus[] =
  [
    'in_use',
    'scheduled',
    'available',
    'maintenance',
    'incapacitated',
    'leave',
    'inactive',
  ];

const STATUS_SORT_RANK = new Map<OperatorOperationalStatus, number>(
  OPERATOR_OPERATIONAL_STATUS_DISPLAY_ORDER.map((status, index) => [
    status,
    index,
  ]),
);

export function operatorOperationalStatusSortRank(
  status: OperatorOperationalStatus | string | undefined,
): number {
  if (!status) {
    return OPERATOR_OPERATIONAL_STATUS_DISPLAY_ORDER.length;
  }
  return (
    STATUS_SORT_RANK.get(status as OperatorOperationalStatus) ??
    OPERATOR_OPERATIONAL_STATUS_DISPLAY_ORDER.length
  );
}

export function compareByOperatorOperationalStatus(
  a: Pick<Operator, 'status' | 'name'>,
  b: Pick<Operator, 'status' | 'name'>,
): number {
  const rankDiff =
    operatorOperationalStatusSortRank(a.status) -
    operatorOperationalStatusSortRank(b.status);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
}

export function sortOperatorsByOperationalStatus<T extends Pick<Operator, 'status' | 'name'>>(
  operators: readonly T[],
): T[] {
  return [...operators].sort(compareByOperatorOperationalStatus);
}
