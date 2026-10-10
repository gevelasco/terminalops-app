const TTL_MS = 45_000;

type Entry = { total: number; at: number };

/** Evita repetir el summary al navegar Maniobras ↔ otro módulo en la misma sesión. */
export function readTripsOperationalSummaryCache(
  companyId: string,
): number | null {
  const id = companyId.trim();
  if (!id) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(`trips:op-summary:${id}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Entry;
    if (
      typeof parsed.total !== 'number' ||
      !Number.isFinite(parsed.total) ||
      Date.now() - parsed.at > TTL_MS
    ) {
      sessionStorage.removeItem(`trips:op-summary:${id}`);
      return null;
    }
    return parsed.total;
  } catch {
    return null;
  }
}

export function writeTripsOperationalSummaryCache(
  companyId: string,
  total: number,
): void {
  const id = companyId.trim();
  if (!id || !Number.isFinite(total)) {
    return;
  }
  try {
    const entry: Entry = { total, at: Date.now() };
    sessionStorage.setItem(`trips:op-summary:${id}`, JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}

export function invalidateTripsOperationalSummaryCache(companyId: string): void {
  const id = companyId.trim();
  if (!id) {
    return;
  }
  try {
    sessionStorage.removeItem(`trips:op-summary:${id}`);
  } catch {
    /* ignore */
  }
}
