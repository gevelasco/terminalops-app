import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

export const CLIENT_YES_NO_OPTIONS: ToSelectOption[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Sí' },
];

/**
 * Estado comercial visible hoy; el valor `not_evaluated` deja lugar al cálculo
 * automático por historial de pagos.
 */
export const CLIENT_COMMERCIAL_HEALTH_OPTIONS: ToSelectOption[] = [
  { value: 'not_evaluated', label: 'Sin evaluar' },
  { value: 'good_standing', label: 'Al corriente' },
  { value: 'watch_list', label: 'En seguimiento' },
  { value: 'restricted', label: 'Restringido' },
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
