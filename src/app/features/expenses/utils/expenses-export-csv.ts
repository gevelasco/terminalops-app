import type { Expense } from '@shared/models/logistics.models';
import {
  expenseKindLabel,
  expenseManeuverCode,
} from '@features/expenses/utils/expense-row-labels';
import { expenseIncurredDateInput } from './expenses-form.util';

function csvCell(value: string): string {
  const t = value.replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

function expenseIncurredYmd(expense: Expense): string {
  return expenseIncurredDateInput(expense.incurredDate ?? expense.incurredAt);
}

export function buildExpensesCsv(
  expenses: readonly Expense[],
  tripManeuverByTripId?: ReadonlyMap<string, string>,
): string {
  const headers = [
    'Rubro',
    'Maniobra',
    'Concepto',
    'Descripción',
    'Monto',
    'Moneda',
    'Fecha',
    'ID',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const e of expenses) {
    lines.push(
      [
        expenseKindLabel(e.kind),
        expenseManeuverCode(e, tripManeuverByTripId),
        e.category,
        e.description?.trim() ?? '',
        String(e.amount),
        e.currency,
        expenseIncurredYmd(e),
        e.id,
      ]
        .map((v) => csvCell(String(v)))
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadExpensesCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
