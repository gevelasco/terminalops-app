/** ISO 6346 sin guiones: ABCD1234567 */
export function normalizeTripContainerNumberInput(
  raw: string | null | undefined,
): string {
  return String(raw ?? '')
    .trim()
    .replace(/[\s-]+/g, '')
    .toUpperCase();
}

export function isValidTripContainerNumberInput(raw: string | null | undefined): boolean {
  const n = normalizeTripContainerNumberInput(raw);
  if (!n) {
    return true;
  }
  return /^[A-Z]{4}\d{7}$/.test(n);
}
