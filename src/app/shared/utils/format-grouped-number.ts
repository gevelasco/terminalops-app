/**
 * Formato de montos/cantidades con separador de miles es-MX (ej. `580,000` / `580,000.5`).
 * Compartido por `to-input` (groupThousands), flota, maniobras y gastos.
 */

export function stripGroupedNumber(raw: string): string {
  return raw.replace(/\s/g, '').replace(/,/g, '').trim();
}

export function parseGroupedNumber(raw: string): number | null {
  const t = stripGroupedNumber(raw);
  if (t === '') {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatGroupedNumber(
  value: number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  const max = options?.maxFractionDigits ?? 2;
  const min = options?.minFractionDigits ?? 0;
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: max,
    minimumFractionDigits: min,
  }).format(value);
}

/** Hidrata un input de monto desde un número API (con comas). */
export function formatMoneyInputValue(
  value: number | string | null | undefined,
): string {
  if (value == null || value === '') {
    return '';
  }
  const n = typeof value === 'number' ? value : parseGroupedNumber(String(value));
  if (n == null) {
    return String(value).trim();
  }
  return formatGroupedNumber(n);
}

/**
 * Reformatea el texto mientras se escribe (solo dígitos + un punto decimal).
 * Devuelve el valor formateado o el original si aún no es parseable.
 */
export function formatGroupedNumberWhileTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (cleaned === '' || cleaned === '.') {
    return cleaned;
  }
  const parts = cleaned.split('.');
  const intPart = parts[0] ?? '';
  const fracPart = parts.length > 1 ? parts.slice(1).join('').slice(0, 2) : null;
  if (intPart === '' && fracPart != null) {
    return `0.${fracPart}`;
  }
  const intNum = Number(intPart || '0');
  if (!Number.isFinite(intNum)) {
    return raw;
  }
  const groupedInt = new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 0,
  }).format(intNum);
  return fracPart != null ? `${groupedInt}.${fracPart}` : groupedInt;
}
