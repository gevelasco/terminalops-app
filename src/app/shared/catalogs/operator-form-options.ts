import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import type {
  OperatorInsuranceKind,
  OperatorLicenseType,
  OperatorOperationalStatus,
  OperatorPaymentSchedule,
} from '@shared/models/logistics.models';

/** Catálogo de labels/filtros de estado operativo del operador. */
export const OPERATOR_OPERATIONAL_STATUS_OPTIONS: ToSelectOption[] = [
  { value: 'available', label: 'Disponible' },
  { value: 'in_use', label: 'En curso' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'leave', label: 'Vacaciones / descanso' },
  { value: 'incapacitated', label: 'Incapacitado' },
  { value: 'inactive', label: 'Inactivo / baja' },
];

export const OPERATOR_LICENSE_TYPE_OPTIONS: ToSelectOption[] = [
  { value: 'unspecified', label: 'No especificado' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'Estatal' },
  { value: 'both', label: 'Federal y estatal' },
];

export const OPERATOR_INSURANCE_KIND_OPTIONS: ToSelectOption[] = [
  { value: 'none', label: 'Ninguno' },
  { value: 'public', label: 'Público (IMSS / seguridad social)' },
  { value: 'private', label: 'Privado' },
];

export const OPERATOR_RELATIONSHIP_OPTIONS: ToSelectOption[] = [
  { value: '', label: 'Selecciona' },
  { value: 'spouse', label: 'Cónyuge' },
  { value: 'parent', label: 'Padre / madre' },
  { value: 'child', label: 'Hijo / hija' },
  { value: 'sibling', label: 'Hermano / hermana' },
  { value: 'other', label: 'Otro' },
];

export const OPERATOR_PREMIUM_PERIOD_OPTIONS: ToSelectOption[] = [
  { value: '', label: 'Selecciona' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
  { value: 'other', label: 'Otro' },
];

/**
 * Contratación (referencia LFT y uso interno; valores estables para mock/API).
 */
export const OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS: ToSelectOption[] = [
  { value: '', label: 'Selecciona' },
  { value: 'indefinite', label: 'Tiempo indeterminado' },
  { value: 'temporary', label: 'Tiempo determinado' },
  { value: 'project', label: 'Por obra o servicio' },
  { value: 'fees', label: 'Honorarios / RESICO' },
  { value: 'other', label: 'Otro' },
];

export const OPERATOR_PAYMENT_SCHEDULE_OPTIONS: ToSelectOption[] = [
  { value: 'maneuver', label: 'Maniobra' },
  { value: 'weekly', label: 'Semana' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];

export function operatorOperationalStatusLabel(
  s: OperatorOperationalStatus,
): string {
  switch (s) {
    case 'available':
      return 'Disponible';
    case 'in_use':
      return 'En curso';
    case 'scheduled':
      return 'Programado';
    case 'incapacitated':
      return 'Incapacitado';
    case 'leave':
      return 'Vacaciones / descanso';
    case 'inactive':
      return 'Inactivo / baja';
  }
}

export function operatorInsuranceKindLabel(k: OperatorInsuranceKind): string {
  switch (k) {
    case 'none':
      return 'Ninguno';
    case 'public':
      return 'Público (IMSS)';
    case 'private':
      return 'Privado';
  }
}

export function operatorLicenseTypeLabel(t: OperatorLicenseType): string {
  switch (t) {
    case 'federal':
      return 'Federal';
    case 'state':
      return 'Estatal';
    case 'both':
      return 'Federal y estatal';
    case 'unspecified':
      return 'No especificado';
  }
}

export function operatorRelationshipLabel(code: string): string {
  const row = OPERATOR_RELATIONSHIP_OPTIONS.find((o) => o.value === code);
  return row?.label && row.value !== '' ? row.label : '—';
}

export function operatorEmploymentContractLabel(code: string): string {
  const row = OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS.find((o) => o.value === code);
  return row?.label && row.value !== '' ? row.label : '—';
}

export function operatorPaymentScheduleLabel(
  schedule: OperatorPaymentSchedule | string,
): string {
  const row = OPERATOR_PAYMENT_SCHEDULE_OPTIONS.find((o) => o.value === schedule);
  return row?.label ?? '—';
}
