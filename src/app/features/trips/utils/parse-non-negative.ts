/** Quita separadores de miles / espacios antes de parsear montos o litros. */
export function stripGroupedNumberInput(raw: string): string {
  const t = raw.replace(/\s/g, '').trim();
  // Formato es-MX: 1.234,56 o 18,5
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t) || /^\d+,\d+$/.test(t)) {
    return t.replace(/\./g, '').replace(',', '.');
  }
  // Formato con miles por coma: 1,234.56
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) {
    return t.replace(/,/g, '');
  }
  return t.replace(/,/g, '');
}

/**
 * Número finito ≥ 0 o `null` si vacío o inválido (sin efectos secundarios;
 * el llamador muestra toasts si aplica).
 */
export function parseNonNegativeNumber(raw: string): number | null {
  const s = stripGroupedNumberInput(raw);
  if (s === '') {
    return null;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}
