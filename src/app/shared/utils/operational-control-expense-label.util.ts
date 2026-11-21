export const DEFAULT_OPERATIONAL_CONTROL_EXPENSE_LABEL = 'Control operativo';

export const OPERATIONAL_CONTROL_EXPENSE_LABEL_MAX = 80;

export function resolveOperationalControlExpenseLabel(
  raw?: string | null,
): string {
  const trimmed = (raw ?? '').trim();
  return trimmed || DEFAULT_OPERATIONAL_CONTROL_EXPENSE_LABEL;
}

/** Valor para enviar al API (`null` = usar etiqueta por defecto). */
export function normalizeOperationalControlExpenseLabelForSave(
  raw: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > OPERATIONAL_CONTROL_EXPENSE_LABEL_MAX) {
    return trimmed.slice(0, OPERATIONAL_CONTROL_EXPENSE_LABEL_MAX);
  }
  return trimmed;
}