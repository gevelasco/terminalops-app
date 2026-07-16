import type { ExpensesListParams } from '@core/services/api/expenses';
import type { Expense } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

/** Tope por consulta filtrada (p. ej. 12 mensualidades + margen). */
export const FLEET_COVERAGE_EXPENSES_PAGE_LIMIT = 48;

export type FleetCoverageExpenseKind = 'insurance' | 'gps' | 'tenure_payment';

export type FleetCoverageExpenseScope =
  | { resource: 'unit'; unitId: string }
  | { resource: 'equipment'; equipmentId: string };

export function buildFleetCoverageExpensesPageParams(
  scope: FleetCoverageExpenseScope,
  kind: FleetCoverageExpenseKind,
  bounds: { from: string; to: string },
): ExpensesListParams {
  const base: ExpensesListParams = {
    from: bounds.from,
    to: bounds.to,
    kind,
    page: 1,
    limit: FLEET_COVERAGE_EXPENSES_PAGE_LIMIT,
  };
  if (scope.resource === 'unit') {
    return { ...base, relatedUnitId: scope.unitId };
  }
  return { ...base, relatedEquipmentId: scope.equipmentId };
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ventana amplia para cargar gastos de seguro/GPS (misma base que el drawer de flota). */
export function fleetCoverageExpensesQueryRange(today = new Date()): { from: string; to: string } {
  const from = new Date(today.getTime());
  from.setMonth(from.getMonth() - 14);
  const to = new Date(today.getTime());
  to.setMonth(to.getMonth() + 14);
  return { from: formatYmd(from), to: formatYmd(to) };
}

function expensesForResource(
  expenses: readonly Expense[],
  kind: FleetCoverageExpenseKind,
  resourceId: string,
  field: 'relatedUnitId' | 'relatedEquipmentId',
): Expense[] {
  const id = resourceIdKey(resourceId);
  if (!id) {
    return [];
  }
  return expenses.filter(
    (e) => e.kind === kind && resourceIdsEqual(e[field], id),
  );
}

export function insuranceExpensesForUnit(
  expenses: readonly Expense[],
  unitId: string,
): Expense[] {
  return expensesForResource(expenses, 'insurance', unitId, 'relatedUnitId');
}

export function insuranceExpensesForEquipment(
  expenses: readonly Expense[],
  equipmentId: string,
): Expense[] {
  return expensesForResource(expenses, 'insurance', equipmentId, 'relatedEquipmentId');
}

export function gpsExpensesForUnit(expenses: readonly Expense[], unitId: string): Expense[] {
  return expensesForResource(expenses, 'gps', unitId, 'relatedUnitId');
}

export function tenureExpensesForUnit(expenses: readonly Expense[], unitId: string): Expense[] {
  return expensesForResource(expenses, 'tenure_payment', unitId, 'relatedUnitId');
}

export function tenureExpensesForEquipment(
  expenses: readonly Expense[],
  equipmentId: string,
): Expense[] {
  return expensesForResource(expenses, 'tenure_payment', equipmentId, 'relatedEquipmentId');
}
