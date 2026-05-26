import type { Expense } from '@shared/models/logistics.models';
import { isOperationalProvisionExpense } from './operational-provision';

const CREDIT_PAYABLE_METHODS = new Set(['credit', 'credit_card', 'card']);

/** Gasto registrado a crédito (proveedor o TDC) que aún representa deuda por pagar. */
export function isExpenseCreditPayable(e: Expense): boolean {
  if (isOperationalProvisionExpense(e)) {
    return false;
  }
  const method = e.paymentMethod?.trim().toLowerCase() ?? '';
  return CREDIT_PAYABLE_METHODS.has(method);
}

export function isExpenseDebitCardPayment(e: Expense): boolean {
  return e.paymentMethod?.trim().toLowerCase() === 'debit_card';
}

export function sumCreditPayableExpensesMxn(expenses: readonly Expense[]): number {
  let sum = 0;
  for (const e of expenses) {
    if (e.currency !== 'MXN' || !isExpenseCreditPayable(e)) {
      continue;
    }
    sum += e.amount;
  }
  return sum;
}
