import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/** Rubro del gasto (define qué relaciones operativas aplican). */
export const EXPENSE_KIND_OPTIONS: ToSelectOption[] = [
  { value: 'fuel', label: 'Combustible' },
  { value: 'tolls', label: 'Casetas' },
  { value: 'per_diem', label: 'Viáticos' },
  { value: 'lodging', label: 'Hospedaje' },
  { value: 'repair', label: 'Reparación' },
  { value: 'tires', label: 'Llantas (desgaste o cambio)' },
  { value: 'maintenance', label: 'Mantenimiento (unidad o equipo)' },
  { value: 'insurance', label: 'Seguro o póliza' },
  { value: 'gps', label: 'GPS o telemetría' },
  { value: 'verification', label: 'Verificación (física, emisiones…)' },
  { value: 'equipment_purchase', label: 'Compra de equipo' },
  { value: 'unit_purchase', label: 'Compra de unidad' },
  { value: 'equipment_rent', label: 'Arriendo de equipo' },
  { value: 'unit_rent', label: 'Arriendo de unidad' },
  { value: 'tenure_payment', label: 'Cuota de financiamiento o arrendamiento' },
  {
    value: 'trailer_admin_payout',
    label: 'Pago por administración de equipo / rendimiento',
  },
  { value: 'operator_payment', label: 'Pago a operador' },
  { value: 'operator_commission', label: 'Pago a operador' },
  { value: 'operational_control', label: 'Control operativo' },
  { value: 'service', label: 'Servicio' },
  { value: 'other', label: 'Otro (general)' },
];

export const EXPENSE_MAINTENANCE_TARGET_OPTIONS: ToSelectOption[] = [
  { value: 'unit', label: 'Unidad tractora' },
  { value: 'equipment', label: 'Equipo' },
];

/** Misma convención que mantenimiento: póliza sobre unidad o sobre equipo. */
export const EXPENSE_INSURANCE_TARGET_OPTIONS: ToSelectOption[] =
  EXPENSE_MAINTENANCE_TARGET_OPTIONS;

export const EXPENSE_VERIFICATION_SCOPE_OPTIONS: ToSelectOption[] = [
  { value: 'phys_mech', label: 'Verificación - físico-mecánica' },
  { value: 'emissions', label: 'Verificación - emisiones' },
  { value: 'double_articulated', label: 'Verificación - doble articulado' },
];

export const EXPENSE_PAYMENT_METHOD_OPTIONS: ToSelectOption[] = [
  { value: '', label: '— Sin especificar —' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'debit_card', label: 'Tarjeta de débito' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'check', label: 'Cheque' },
  { value: 'credit', label: 'Crédito / proveedor' },
  { value: 'other', label: 'Otro' },
];

/** Métodos de pago requeridos para gastos automáticos de maniobra (sin opción vacía). */
export const TRIP_AUTO_EXPENSE_PAYMENT_METHOD_OPTIONS: ToSelectOption[] =
  EXPENSE_PAYMENT_METHOD_OPTIONS.filter((option) => option.value !== '');

export const EXPENSE_CURRENCY_OPTIONS: ToSelectOption[] = [
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar' },
];
