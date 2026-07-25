import type { MaintenanceEntry } from '@shared/models/logistics.models';

/** Entrada con fecha, costo o notas; el tipo solo no basta (evita filas fantasma). */
export function isSubstantiveMaintenanceEntry(
  entry: MaintenanceEntry | undefined,
): boolean {
  if (!entry) {
    return false;
  }
  if (entry.date?.trim()) {
    return true;
  }
  if (entry.notes?.trim()) {
    return true;
  }
  if (entry.cost != null && Number.isFinite(entry.cost) && entry.cost > 0) {
    return true;
  }
  if ((entry.documentNames?.length ?? 0) > 0) {
    return true;
  }
  return false;
}

/**
 * Los documentos de mantenimiento viven a nivel unidad (`fleetDocuments` /
 * `documentMaintenanceNames`), no en cada fila del historial. Para la tabla
 * Docs, se muestran en la entrada más reciente.
 */
export function attachFleetMaintenanceDocNamesToNewestEntry(
  entries: readonly MaintenanceEntry[],
  maintDocNames: readonly string[],
): MaintenanceEntry[] {
  if (entries.length === 0 || maintDocNames.length === 0) {
    return [...entries];
  }
  const [newest, ...rest] = entries;
  const existing = newest.documentNames ?? [];
  const merged = [...existing];
  for (const name of maintDocNames) {
    const trimmed = name.trim();
    if (trimmed && !merged.includes(trimmed)) {
      merged.push(trimmed);
    }
  }
  if (merged.length === existing.length) {
    return [...entries];
  }
  return [{ ...newest, documentNames: merged }, ...rest];
}
