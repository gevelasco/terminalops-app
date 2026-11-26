import type { RouteTollPlazaRow } from '@core/services/api/routing';
import { latLonFromTollPlazaRow } from '@features/clients/utils/destination-rate-inegi-point.util';

function parseRouteTollPlazasArray(raw: unknown): RouteTollPlazaRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: RouteTollPlazaRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const plazaKey = String(row['plazaKey'] ?? '').trim();
    const name = String(row['name'] ?? '').trim();
    if (!plazaKey || !name) {
      continue;
    }
    const orderRaw = Number(row['order']);
    const order = Number.isFinite(orderRaw) ? orderRaw : rows.length + 1;
    const costRaw = row['costMxn'];
    const costMxn =
      costRaw == null || costRaw === ''
        ? null
        : Number.isFinite(Number(costRaw))
          ? Number(costRaw)
          : null;
    const source = String(row['plazaKeySource'] ?? '').trim();
    const inegiPoint = String(row['inegiPoint'] ?? row['inegi_point'] ?? '').trim();
    const section = String(row['section'] ?? '').trim();
    const municipality = String(row['municipality'] ?? '').trim();
    const state = String(row['state'] ?? '').trim();
    const latRaw = Number(row['lat']);
    const lngRaw = Number(row['lng'] ?? row['lon']);
    const costsByAxleRaw = row['costsByAxle'];
    const costsByAxle =
      costsByAxleRaw && typeof costsByAxleRaw === 'object'
        ? (costsByAxleRaw as Record<string, number | null>)
        : undefined;
    rows.push({
      order,
      plazaKey,
      ...(source === 'catalog' || source === 'inegi' || source === 'fallback'
        ? { plazaKeySource: source as 'catalog' | 'inegi' | 'fallback' }
        : {}),
      ...(inegiPoint ? { inegiPoint } : {}),
      ...(section ? { section } : {}),
      ...(municipality ? { municipality } : {}),
      ...(state ? { state } : {}),
      ...(Number.isFinite(latRaw) ? { lat: latRaw } : {}),
      ...(Number.isFinite(lngRaw) ? { lng: lngRaw } : {}),
      ...(costsByAxle ? { costsByAxle } : {}),
      name,
      costMxn,
    });
  }
  return rows.sort((a, b) => a.order - b.order);
}

/** Casetas persistidas en la tarifa (acepta nombre legado de columna preview). */
export function parseRouteTollPlazasFromApi(row: Record<string, unknown>): RouteTollPlazaRow[] {
  const raw =
    row['routeTollPlazas'] ??
    row['route_toll_plazas'] ??
    row['routeTollPlazaPreview'] ??
    row['route_toll_plaza_preview'];
  return parseRouteTollPlazasArray(raw);
}

export function enrichTollPlazaRowForMap(row: RouteTollPlazaRow): RouteTollPlazaRow {
  if (row.inegiPoint?.trim()) {
    return row;
  }
  const ll = latLonFromTollPlazaRow(row);
  if (!ll) {
    return row;
  }
  return { ...row, inegiPoint: `${ll.lat},${ll.lon}` };
}

export function enrichTollPlazaRowsForMap(
  plazas: readonly RouteTollPlazaRow[],
): RouteTollPlazaRow[] {
  return plazas.map(enrichTollPlazaRowForMap);
}

/** Lista final de casetas para persistir con la tarifa. */
export function routeTollPlazasForApi(
  plazas: readonly RouteTollPlazaRow[],
): RouteTollPlazaRow[] {
  return plazas.map((p) => {
    let inegiPoint = p.inegiPoint?.trim() ?? '';
    if (!inegiPoint) {
      const ll = latLonFromTollPlazaRow(p);
      if (ll) {
        inegiPoint = `${ll.lat},${ll.lon}`;
      }
    }
    const section = p.section?.trim() ?? '';
    const municipality = p.municipality?.trim() ?? '';
    const state = p.state?.trim() ?? '';
    return {
      order: p.order,
      plazaKey: p.plazaKey,
      ...(p.plazaKeySource ? { plazaKeySource: p.plazaKeySource } : {}),
      ...(inegiPoint ? { inegiPoint } : {}),
      ...(section ? { section } : {}),
      ...(municipality ? { municipality } : {}),
      ...(state ? { state } : {}),
      ...(p.lat != null && Number.isFinite(p.lat) ? { lat: p.lat } : {}),
      ...(p.lng != null && Number.isFinite(p.lng) ? { lng: p.lng } : {}),
      ...(p.costsByAxle ? { costsByAxle: p.costsByAxle } : {}),
      name: p.name.trim(),
      costMxn: p.costMxn,
    };
  });
}