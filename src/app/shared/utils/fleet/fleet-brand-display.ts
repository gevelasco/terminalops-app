/** Etiqueta visible de marca (nombre en fleetMeta o abreviatura legacy). */
export function fleetBrandDisplayName(parts: {
  trailerBrandName?: string;
  trailerBrandAbbr?: string;
}): string {
  const name = parts.trailerBrandName?.trim();
  if (name) {
    return name;
  }
  const abbr = parts.trailerBrandAbbr?.trim();
  return abbr || '—';
}
