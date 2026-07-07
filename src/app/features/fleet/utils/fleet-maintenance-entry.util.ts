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
