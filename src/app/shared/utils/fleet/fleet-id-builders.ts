import { deriveFleetBrandAbbr } from './derive-fleet-brand-abbr';
import type { Equipment, Unit } from '@shared/models/logistics.models';
import { resourceIdKey } from '@shared/utils/resource-id';

/** Placa normalizada para formar el código (espacios → guiones). */
export function normalizePlateForFleetId(plate: string): string {
  return plate.trim().replace(/\s+/g, '-');
}

/** Fragmento alfanumérico a partir de serie (desambiguación de equipos). */
export function slugFromSerial(serial: string, maxLen = 12): string {
  const t = serial.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (t.slice(0, maxLen) || 'EQ').trim();
}

/**
 * Código interno de unidad: `MARCA-AÑO-PLACA` (ej. `HYU-2021-81-AA-9K`).
 * Requiere abreviatura, año y placa; si falta algo devuelve un temporal único.
 */
export function buildUnitFleetOperationalId(parts: {
  trailerBrandAbbr?: string;
  trailerYear?: string;
  plate: string;
}): string {
  const abbr = (parts.trailerBrandAbbr ?? '').trim().toUpperCase();
  const year = (parts.trailerYear ?? '').trim();
  const plate = normalizePlateForFleetId(parts.plate);
  if (abbr && year && plate) {
    return `${abbr}-${year}-${plate}`;
  }
  return `GEN-${Date.now()}`;
}

export function ensureUniqueFleetId(base: string, existingIds: ReadonlySet<string>): string {
  if (!existingIds.has(base)) {
    return base;
  }
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}

/**
 * Código interno de equipo (remolque): mismo patrón que unidad; si colisiona
 * con un `id` de unidad u otro equipo, se añade sufijo desde la serie.
 */
export function buildEquipmentFleetOperationalId(
  equipmentList: readonly Equipment[],
  units: readonly Unit[],
  p: Pick<Equipment, 'trailerBrandAbbr' | 'trailerYear' | 'plate' | 'serialNumber'>,
): string {
  const abbr = (p.trailerBrandAbbr ?? '').trim().toUpperCase();
  const year = (p.trailerYear ?? '').trim();
  const plateRaw = (p.plate ?? '').trim();
  const serialSlug = slugFromSerial(p.serialNumber || 'EQ', 12);
  const plateNorm = plateRaw ? normalizePlateForFleetId(plateRaw) : '';
  const core =
    abbr && year && plateNorm
      ? `${abbr}-${year}-${plateNorm}`
      : abbr && year
        ? `${abbr}-${year}-${serialSlug}`
        : `EQ-${serialSlug}`;

  const occupied = new Set<string>([
    ...units.map((u) => u.id),
    ...equipmentList.map((e) => e.id),
  ]);

  if (!occupied.has(core)) {
    return core;
  }
  const withSerial = `${core}-${serialSlug}`;
  if (!occupied.has(withSerial)) {
    return withSerial;
  }
  return ensureUniqueFleetId(withSerial, occupied);
}

/** Abreviatura de marca para armar el código (columna o `fleetMeta.trailerBrandName`). */
function resolveEquipmentBrandAbbr(e: Equipment): string {
  const abbr = e.trailerBrandAbbr?.trim();
  if (abbr) {
    return abbr.toUpperCase();
  }
  const name = e.fleetMeta?.trailerBrandName?.trim();
  if (!name) {
    return '';
  }
  return deriveFleetBrandAbbr(name);
}

/**
 * Código operativo visible del equipo (`MARCA-AÑO-PLACA`, mismo criterio que unidad).
 * No usa el `id` numérico de base de datos (ese va en «ID interno»).
 */
export function formatEquipmentOperationalId(e: Equipment): string {
  const built = buildUnitFleetOperationalId({
    trailerBrandAbbr: resolveEquipmentBrandAbbr(e) || e.trailerBrandAbbr,
    trailerYear: e.trailerYear,
    plate: e.plate ?? '',
  });
  if (built.startsWith('GEN-')) {
    return resourceIdKey(e.id);
  }
  return built;
}
