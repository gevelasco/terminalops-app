import type { Expense } from '@shared/models/logistics.models';
import { expenseIncurredDateInput } from '@features/expenses/utils/expenses-form.util';

export function expenseCoverageInstallmentIndex(
  description: string | null | undefined,
): number | null {
  const match = /\(Mensualidad (\d+)\/\d+\)/.exec(description ?? '');
  if (!match) {
    return null;
  }
  const index = Number(match[1]);
  return Number.isFinite(index) && index > 0 ? index : null;
}

export function fleetPaymentExpenseForCycle(
  dueDate: string,
  lastPaymentDate: string | undefined,
  paymentExpenses: readonly Expense[],
  cycleIndex?: number,
): Expense | undefined {
  if (cycleIndex != null) {
    const byInstallment = paymentExpenses.find(
      (expense) => expenseCoverageInstallmentIndex(expense.description) === cycleIndex,
    );
    if (byInstallment) {
      return byInstallment;
    }
  }

  const normalizedDue = dueDate.trim();
  const direct = paymentExpenses.find(
    (expense) => expenseIncurredDateInput(expense.incurredAt) === normalizedDue,
  );
  if (direct) {
    return direct;
  }

  const lastPaid = lastPaymentDate?.trim();
  if (!lastPaid || lastPaid < normalizedDue || cycleIndex != null) {
    return undefined;
  }

  let matched: Expense | undefined;
  for (const expense of paymentExpenses) {
    const paidYmd = expenseIncurredDateInput(expense.incurredAt);
    if (paidYmd < normalizedDue) {
      continue;
    }
    if (!matched) {
      matched = expense;
      continue;
    }
    const currentYmd = expenseIncurredDateInput(matched.incurredAt);
    if (paidYmd.localeCompare(currentYmd) < 0) {
      matched = expense;
    }
  }
  return matched;
}

export function fleetCycleIsPaid(
  dueDate: string,
  lastPaymentDate: string | undefined,
  matchedExpense: Expense | undefined,
): boolean {
  void dueDate;
  void lastPaymentDate;
  return matchedExpense != null;
}
