import type { TripClientPaymentMethod } from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

export const TRIP_CLIENT_PAYMENT_METHOD_OPTIONS: ToSelectOption[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'check', label: 'Cheque' },
  { value: 'debit_card', label: 'Tarjeta de débito' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
];

/** Opciones del select «Método de pago» en nueva maniobra. */
export const TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS: ToSelectOption[] =
  TRIP_CLIENT_PAYMENT_METHOD_OPTIONS;

export function tripManeuverPaymentMethodLabel(value: string | undefined): string {
  const key = (value ?? '').trim();
  if (!key) {
    return '—';
  }
  return (
    TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS.find((opt) => opt.value === key)?.label ??
    TRIP_CLIENT_PAYMENT_METHOD_OPTIONS.find((opt) => opt.value === key)?.label ??
    key
  );
}

export function isTripManeuverPaymentMethod(value: string): value is 'cash' | 'transfer' | 'check' {
  return TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS.some((opt) => opt.value === value);
}

export function isTripClientPaymentMethod(
  value: string,
): value is TripClientPaymentMethod {
  return TRIP_CLIENT_PAYMENT_METHOD_OPTIONS.some((opt) => opt.value === value);
}
