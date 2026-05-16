/** Quita separadores de miles / espacios antes de parsear montos o litros. */
export function stripGroupedNumberInput(raw: string): string {
  return raw.replace(/\s/g, '').replace(/,/g, '').trim();
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
