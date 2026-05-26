import type { TripClientPaymentMethod } from '@shared/models/logistics.models';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

export const TRIP_CLIENT_PAYMENT_METHOD_OPTIONS: ToSelectOption[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'check', label: 'Cheque' },
  { value: 'debit_card', label: 'Tarjeta de débito' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
];

export function isTripClientPaymentMethod(
  value: string,
): value is TripClientPaymentMethod {
  return TRIP_CLIENT_PAYMENT_METHOD_OPTIONS.some((opt) => opt.value === value);
}
