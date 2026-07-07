import type { Expense, ExpenseKind } from '@shared/models/logistics.models';
import type { ToFilterTab } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import {
  isExpenseEquipmentOnlyKind,
  isExpenseOperatorKind,
  isExpenseTiresKind,
  isExpenseUnitOnlyAssetKind,
} from '@features/expenses/utils/expenses-form.util';
import type { ExpenseRubro } from '@features/expenses/utils/expense-rubro.util';

export type ExpenseOperationalRelationTab =
  | 'trip'
  | 'unit'
  | 'equipment'
  | 'operator';

export const EXPENSE_OPERATIONAL_RELATION_TABS: readonly ToFilterTab<ExpenseOperationalRelationTab>[] =
  [
    { id: 'trip', label: 'Maniobra', icon: 'route' },
    { id: 'unit', label: 'Unidad', icon: 'truck' },
    { id: 'equipment', label: 'Equipo', icon: 'equipment' },
    { id: 'operator', label: 'Operador', icon: 'groups' },
  ];

export function inferExpenseRelationTab(
  expense: Pick<
    Expense,
    'tripId' | 'relatedUnitId' | 'relatedEquipmentId' | 'relatedOperatorId'
  >,
): ExpenseOperationalRelationTab {
  if (expense.tripId?.trim()) {
    return 'trip';
  }
  if (expense.relatedUnitId?.trim()) {
    return 'unit';
  }
  if (expense.relatedEquipmentId?.trim()) {
    return 'equipment';
  }
  if (expense.relatedOperatorId?.trim()) {
    return 'operator';
  }
  return 'trip';
}

export function expenseRelationTripHint(isManiobraRubro: boolean): string {
  if (isManiobraRubro) {
    return 'Obligatorio para rubro maniobra: busca por código. El código aparecerá en la columna Maniobra del listado.';
  }
  return 'Opcional: vincula una maniobra si el gasto corresponde a un viaje concreto.';
}

export function expenseRelationUnitHint(kind: ExpenseKind): string {
  switch (kind) {
    case 'maintenance':
      return 'Mantenimiento aplicado a la unidad tractora.';
    case 'insurance':
      return 'Póliza o seguro sobre la unidad tractora.';
    case 'gps':
      return 'Servicio de GPS o telemetría en la unidad.';
    case 'verification':
      return 'Verificación físico-mecánica, de emisiones o doble articulado (SPP) de la unidad.';
    case 'tires':
      return 'Gasto de llantas vinculado a la unidad tractora.';
    case 'unit_purchase':
    case 'unit_rent':
      return 'Compra o arriendo de unidad tractora.';
    default:
      return 'Vincula el gasto a una unidad tractora cuando aplique.';
  }
}

export function expenseRelationEquipmentHint(kind: ExpenseKind): string {
  switch (kind) {
    case 'maintenance':
      return 'Mantenimiento aplicado al equipo (dolly incluido).';
    case 'insurance':
      return 'Póliza o seguro sobre el equipo.';
    case 'equipment_purchase':
    case 'equipment_rent':
    case 'trailer_admin_payout':
      return 'Vincula el gasto al equipo correspondiente.';
    default:
      return 'Vincula el gasto a un equipo cuando aplique.';
  }
}

export function expenseRelationOperatorHint(kind: ExpenseKind): string {
  if (isExpenseOperatorKind(kind)) {
    return 'Selecciona el operador al que corresponde el pago o la comisión.';
  }
  return 'Opcional: vincula un operador si el gasto le corresponde sin maniobra asociada.';
}

export function expenseRelationUnitRequired(kind: ExpenseKind): boolean {
  return (
    kind === 'maintenance' ||
    kind === 'insurance' ||
    kind === 'gps' ||
    kind === 'verification' ||
    isExpenseTiresKind(kind) ||
    isExpenseUnitOnlyAssetKind(kind)
  );
}

export function expenseRelationEquipmentRequired(kind: ExpenseKind): boolean {
  return (
    kind === 'maintenance' ||
    kind === 'insurance' ||
    isExpenseEquipmentOnlyKind(kind)
  );
}

export function expenseRelationOperatorRequired(kind: ExpenseKind): boolean {
  return isExpenseOperatorKind(kind);
}

export function expenseRelationTabHasValue(
  tab: ExpenseOperationalRelationTab,
  expense: Pick<
    Expense,
    'tripId' | 'relatedUnitId' | 'relatedEquipmentId' | 'relatedOperatorId'
  >,
  tripManeuverCode?: string,
): boolean {
  switch (tab) {
    case 'trip':
      return (
        Boolean(expense.tripId?.trim()) &&
        Boolean(tripManeuverCode?.trim() && tripManeuverCode !== '—')
      );
    case 'unit':
      return Boolean(expense.relatedUnitId?.trim());
    case 'equipment':
      return Boolean(expense.relatedEquipmentId?.trim());
    case 'operator':
      return Boolean(expense.relatedOperatorId?.trim());
    default:
      return false;
  }
}

export function expenseRelationTripRequired(rubro: ExpenseRubro): boolean {
  return rubro === 'maniobra';
}
