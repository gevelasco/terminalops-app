import type { TripContainerType } from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/**
 * Tipos de contenedor ISO usados en arrastre portuario y carretera en México.
 * DC = Dry Container / Dry Van (altura estándar 8′6″); HC = High Cube (9′6″).
 */
export const TRIP_CONTAINER_TYPE_OPTIONS: ToSelectOption[] = [
  { value: '40hc', label: "40′ HC (High Cube)" },
  { value: '40dc', label: "40′ DC (estándar)" },
  { value: '20dc', label: "20′ DC (estándar)" },
  { value: '45hc', label: "45′ HC (High Cube)" },
  { value: '20hc', label: "20′ HC (High Cube)" },
  { value: 'na', label: 'No aplica' },
];

const LABELS: Record<string, string> = {
  '20dc': "20′ DC (estándar)",
  '20hc': "20′ HC (High Cube)",
  '40dc': "40′ DC (estándar)",
  '40hc': "40′ HC (High Cube)",
  '45hc': "45′ HC (High Cube)",
  na: 'No aplica',
  /** Valores históricos (pre-normalización). */
  '20ft': "20′ DC (estándar)",
  '40ft': "40′ DC (estándar)",
};

/** Normaliza códigos legacy del API o historial de carga al catálogo vigente. */
export function normalizeTripContainerType(raw: string | undefined | null): TripContainerType {
  const key = (raw ?? '').trim();
  switch (key) {
    case '20ft':
      return '20dc';
    case '40ft':
      return '40dc';
    case '20dc':
    case '20hc':
    case '40dc':
    case '40hc':
    case '45hc':
    case 'na':
      return key;
    default:
      return 'na';
  }
}

export function tripContainerTypeLabelMx(ct: string | undefined | null): string {
  const key = (ct ?? '').trim();
  if (!key) {
    return '—';
  }
  return LABELS[key] ?? key;
}

export function isTripContainerType(value: string): value is TripContainerType {
  return TRIP_CONTAINER_TYPE_OPTIONS.some((opt) => opt.value === value);
}
