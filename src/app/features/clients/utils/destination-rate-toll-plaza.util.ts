import type { RouteTollPlazaRow } from '@core/services/api/routing';

export function activeTollPlazas(
  plazas: readonly RouteTollPlazaRow[],
  excludedPlazaKeys: ReadonlySet<string>,
): RouteTollPlazaRow[] {
  return plazas.filter((p) => !excludedPlazaKeys.has(p.plazaKey));
}

export function tollRoundTripMxnFromPlazas(
  plazas: readonly RouteTollPlazaRow[],
  excludedPlazaKeys: ReadonlySet<string>,
): number | null {
  let sum = 0;
  let any = false;
  for (const plaza of plazas) {
    if (excludedPlazaKeys.has(plaza.plazaKey)) {
      continue;
    }
    if (plaza.costMxn != null && Number.isFinite(plaza.costMxn)) {
      sum += plaza.costMxn;
      any = true;
    }
  }
  if (!any) {
    return null;
  }
  return Math.round(sum * 2 * 100) / 100;
}