/** trim → colapsar espacios → lowercase (misma regla que backend). */
export function normalizeFleetBrandName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.split(/\s+/).filter(Boolean).join(' ').toLowerCase();
}

export function fleetBrandNamesMatch(a: string, b: string): boolean {
  return normalizeFleetBrandName(a) === normalizeFleetBrandName(b);
}
