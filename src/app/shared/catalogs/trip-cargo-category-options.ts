import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/**
 * Clasificación operativa de la mercancía (autotransporte de carga).
 * Distinto de `TripLoadType` (lleno / vacío).
 */
export const TRIP_CARGO_CATEGORY_VALUES = [
  'contenedor',
  'material',
  'mineral',
  'liquido',
  'maquinaria',
  'rollos',
] as const;

export type TripCargoCategory = (typeof TRIP_CARGO_CATEGORY_VALUES)[number];

export const TRIP_CARGO_CATEGORY_OPTIONS: ToSelectOption[] = [
  { value: 'contenedor', label: 'Contenedor' },
  { value: 'material', label: 'Material / carga general' },
  { value: 'mineral', label: 'Mineral (granel sólido)' },
  { value: 'liquido', label: 'Líquido a granel' },
  { value: 'maquinaria', label: 'Maquinaria / sobredimensionada' },
  { value: 'rollos', label: 'Rollos (bobinas, lámina)' },
];

const TRIP_CARGO_CATEGORY_LABELS: Record<TripCargoCategory, string> = {
  contenedor: 'Contenedor',
  material: 'Material / carga general',
  mineral: 'Mineral (granel sólido)',
  liquido: 'Líquido a granel',
  maquinaria: 'Maquinaria / sobredimensionada',
  rollos: 'Rollos (bobinas, lámina)',
};

export function normalizeTripCargoCategory(
  raw: string | null | undefined,
): TripCargoCategory {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  return (TRIP_CARGO_CATEGORY_VALUES as readonly string[]).includes(v)
    ? (v as TripCargoCategory)
    : 'material';
}

export function tripCargoCategoryLabelMx(raw: string | null | undefined): string {
  return TRIP_CARGO_CATEGORY_LABELS[normalizeTripCargoCategory(raw)];
}

export function isTripCargoCategory(value: string): value is TripCargoCategory {
  return (TRIP_CARGO_CATEGORY_VALUES as readonly string[]).includes(value);
}
