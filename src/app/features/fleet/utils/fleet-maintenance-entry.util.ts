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
 * Legacy: todos los archivos vivían a nivel unidad y la UI los mostraba en la
 * fila más reciente. Solo aplica cuando ninguna fila trae `documentNames`.
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

/**
 * Arma el historial para la tabla: cada fila usa los `documentNames` persistidos
 * en API; sin eso (datos viejos), se mantiene el comportamiento legacy.
 */
export function mergeFleetMaintenanceDocNamesForDisplay(
  entries: readonly MaintenanceEntry[],
  unitLevelDocNames: readonly string[],
): MaintenanceEntry[] {
  if (entries.length === 0 || unitLevelDocNames.length === 0) {
    return [...entries];
  }
  const anyRowHasDocNames = entries.some(
    (e) => (e.documentNames?.length ?? 0) > 0,
  );
  if (!anyRowHasDocNames) {
    return attachFleetMaintenanceDocNamesToNewestEntry(entries, unitLevelDocNames);
  }
  return [...entries];
}