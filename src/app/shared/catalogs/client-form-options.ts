import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

export const CLIENT_YES_NO_OPTIONS: ToSelectOption[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Sí' },
];

/** Disponibilidad de tarifa operativa por destino. */
export const DESTINATION_RATE_AVAILABILITY_OPTIONS: ToSelectOption[] = [
  { value: 'yes', label: 'Disponible' },
  { value: 'no', label: 'Inactiva' },
];

/** Unidad para tiempos estimados de referencia en tarifas por ruta. */
export const DESTINATION_RATE_TIME_UNIT_OPTIONS: ToSelectOption[] = [
  { value: '', label: 'Sin especificar' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Días' },
];

/** Etiquetas del estatus comercial calculado (maniobras + cartera). */
export const CLIENT_COMMERCIAL_HEALTH_OPTIONS: ToSelectOption[] = [
  { value: 'not_evaluated', label: 'Sin evaluar' },
  { value: 'good_standing', label: 'Vigente' },
  { value: 'due_soon', label: 'Vence pronto' },
  { value: 'watch_list', label: 'En seguimiento' },
  { value: 'restricted', label: 'Vencido' },
];

export function clientCommercialHealthLabel(code: string | undefined): string {
  if (!code) {
    return '—';
  }
  return (
    CLIENT_COMMERCIAL_HEALTH_OPTIONS.find((o) => o.value === code)?.label ??
    code
  );
}
