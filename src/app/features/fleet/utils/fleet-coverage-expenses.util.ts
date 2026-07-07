import type { Expense } from '@shared/models/logistics.models';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';

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
  kind: 'insurance' | 'gps',
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
