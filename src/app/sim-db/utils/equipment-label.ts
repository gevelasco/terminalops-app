import type { Equipment } from '@shared/models/logistics.models';

/** Etiqueta de equipo a partir del id y el catálogo en memoria (hoy coincide con `id`). */
export function labelForEquipmentId(
  equipmentId: string,
  equipment: readonly Equipment[],
): string {
  const id = equipmentId?.trim();
  if (!id) {
    return '—';
  }
  const e = equipment.find((x) => x.id === id);
  return e ? e.id : id;
}
