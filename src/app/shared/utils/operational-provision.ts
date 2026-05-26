import type { Expense, ExpenseKind } from '@shared/models/logistics.models';

/** Proveedor estándar para montos estimados al programar (no son pagos reales aún). */
export const OPERATIONAL_PROVISION_VENDOR =
  'Provisión operativa — estimado automático';

export function isWearRelatedExpenseKind(kind: ExpenseKind): boolean {
  return kind === 'tires' || kind === 'maintenance' || kind === 'repair';
}

/** Gasto generado automáticamente como reserva por km / desgaste (no ejercido en taller). */
export function isOperationalProvisionExpense(e: Expense): boolean {
  if (e.isOperationalProvision === true) {
    return true;
  }
  const vendor = e.vendor?.trim() ?? '';
  if (
    vendor.includes('estimado automático') ||
    vendor.includes('reserva automática')
  ) {
    return true;
  }
  return /-(caja|prov)-(llantas|pm)(-.+)?$/.test(e.id.trim());
}

export function withoutOperationalProvisionExpenses(
  expenses: readonly Expense[],
): Expense[] {
  return expenses.filter((e) => !isOperationalProvisionExpense(e));
}
